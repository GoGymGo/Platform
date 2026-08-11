import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { canDeleteLegalDocument } from '../operator/admin-deletion-policy';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import type { AdminDeletedEntityResponseDto } from '../operator/dto/admin-configuration.dto';
import type {
  AdminLegalDocumentResponseDto,
  LegalDocumentContentDto,
  PublishLegalDocumentDto,
  WithdrawLegalDocumentDto,
} from './dto/legal.dto';
import {
  hashLegalDocumentContent,
  normalizeJurisdictionCode,
  normalizeLegalLocale,
} from './legal-document';

@Injectable()
export class AdminLegalDocumentsService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async publish(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: PublishLegalDocumentDto,
  ): Promise<AdminLegalDocumentResponseDto> {
    if (input.ownerApprovalConfirmed !== true) {
      throw new BadRequestException({
        code: 'LEGAL_OWNER_APPROVAL_REQUIRED',
        message:
          'The GoGymGo owner must explicitly approve this exact legal version before publication.',
      });
    }
    const jurisdictionCode = normalizeJurisdictionCode(input.jurisdictionCode);
    const locale = normalizeLegalLocale(input.locale);
    const title = input.title.trim();
    const content = this.toContent(input.content);
    const contentSha256 = hashLegalDocumentContent(title, content);
    const effectiveAt = new Date(input.effectiveAt);
    const result = await this.idempotency.execute<JsonObject>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope: 'admin-legal-documents:publish',
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const ownerEmail = this.config.get('GOGYMGO_OWNER_EMAIL', {
          infer: true,
        });
        if (
          !ownerEmail ||
          principal.email?.trim().toLowerCase() !== ownerEmail
        ) {
          throw new ForbiddenException({
            code: 'LEGAL_OWNER_APPROVAL_REQUIRED',
            message:
              'Only the configured GoGymGo owner may approve a legal version for publication.',
          });
        }
        const lockKey = [input.documentKey, jurisdictionCode, locale].join(':');
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`.execute(
          transaction,
        );

        const duplicate = await transaction
          .selectFrom('legal_documents')
          .select('id')
          .where('document_key', '=', input.documentKey)
          .where('jurisdiction_code', '=', jurisdictionCode)
          .where('locale', '=', locale)
          .where('version', '=', input.version)
          .executeTakeFirst();
        if (duplicate) {
          throw new ConflictException({
            code: 'LEGAL_DOCUMENT_VERSION_EXISTS',
            message:
              'This legal document version already exists for the jurisdiction and locale.',
          });
        }
        const latest = await transaction
          .selectFrom('legal_documents')
          .select('effective_at')
          .where('document_key', '=', input.documentKey)
          .where('jurisdiction_code', '=', jurisdictionCode)
          .where('locale', '=', locale)
          .orderBy('effective_at', 'desc')
          .executeTakeFirst();
        if (latest && effectiveAt <= latest.effective_at) {
          throw new ConflictException({
            code: 'LEGAL_DOCUMENT_EFFECTIVE_TIME_NOT_SEQUENTIAL',
            message:
              'A new legal document version must become effective after every earlier version in the same scope.',
          });
        }

        const now = new Date();
        const document = await transaction
          .insertInto('legal_documents')
          .values({
            content,
            content_sha256: contentSha256,
            created_at: now,
            document_key: input.documentKey,
            effective_at: effectiveAt,
            jurisdiction_code: jurisdictionCode,
            locale,
            owner_approved_at: now,
            owner_approved_by_user_id: admin.id,
            receipt_requirement: input.receiptRequirement,
            title,
            version: input.version.trim(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('legal_document_events')
          .values({
            actor_user_id: admin.id,
            created_at: now,
            legal_document_id: document.id,
            next_state: 'published',
            previous_state: null,
            reason: input.reason.trim(),
            request_id: idempotencyKey,
          })
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'legal_document.published',
          actorUserId: admin.id,
          entityId: document.id,
          entityType: 'legal_documents',
          nextState: {
            contentSha256,
            documentKey: input.documentKey,
            effectiveAt: effectiveAt.toISOString(),
            jurisdictionCode,
            locale,
            ownerApprovedAt: now.toISOString(),
            ownerApprovedByUserId: admin.id,
            receiptRequirement: input.receiptRequirement,
            version: input.version,
          },
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          contentSha256,
          id: document.id,
          status: effectiveAt <= now ? 'effective' : 'scheduled',
        };
      },
    );
    return result as unknown as AdminLegalDocumentResponseDto;
  }

  async withdraw(
    principal: AuthenticatedPrincipal,
    legalDocumentId: string,
    idempotencyKey: string,
    input: WithdrawLegalDocumentDto,
  ): Promise<AdminLegalDocumentResponseDto> {
    const result = await this.idempotency.execute<JsonObject>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { legalDocumentId, reason: input.reason },
        scope: 'admin-legal-documents:withdraw',
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const document = await transaction
          .selectFrom('legal_documents')
          .select(['content_sha256', 'id'])
          .where('id', '=', legalDocumentId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!document) {
          throw new NotFoundException({
            code: 'LEGAL_DOCUMENT_NOT_FOUND',
            message: 'The legal document was not found.',
          });
        }
        const event = await transaction
          .selectFrom('legal_document_events')
          .select('next_state')
          .where('legal_document_id', '=', document.id)
          .orderBy('created_at', 'desc')
          .orderBy('id', 'desc')
          .executeTakeFirstOrThrow();
        if (event.next_state === 'withdrawn') {
          return {
            contentSha256: document.content_sha256,
            id: document.id,
            status: 'withdrawn',
          };
        }

        const now = new Date();
        await transaction
          .insertInto('legal_document_events')
          .values({
            actor_user_id: admin.id,
            created_at: now,
            legal_document_id: document.id,
            next_state: 'withdrawn',
            previous_state: 'published',
            reason: input.reason.trim(),
            request_id: idempotencyKey,
          })
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'legal_document.withdrawn',
          actorUserId: admin.id,
          entityId: document.id,
          entityType: 'legal_documents',
          nextState: { state: 'withdrawn' },
          previousState: { state: 'published' },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          contentSha256: document.content_sha256,
          id: document.id,
          status: 'withdrawn',
        };
      },
    );
    return result as unknown as AdminLegalDocumentResponseDto;
  }

  async delete(
    principal: AuthenticatedPrincipal,
    legalDocumentId: string,
    idempotencyKey: string,
    input: WithdrawLegalDocumentDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    const result = await this.idempotency.execute<JsonObject>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { legalDocumentId, reason: input.reason },
        scope: `admin-legal-documents:${legalDocumentId}:delete`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const document = await transaction
          .selectFrom('legal_documents')
          .select(['content_sha256', 'document_key', 'id', 'version'])
          .where('id', '=', legalDocumentId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!document) {
          throw new NotFoundException({
            code: 'LEGAL_DOCUMENT_NOT_FOUND',
            message: 'The legal document was not found.',
          });
        }
        const event = await transaction
          .selectFrom('legal_document_events')
          .select('next_state')
          .where('legal_document_id', '=', legalDocumentId)
          .orderBy('created_at', 'desc')
          .orderBy('id', 'desc')
          .executeTakeFirstOrThrow();
        if (!canDeleteLegalDocument(event.next_state)) {
          throw new ConflictException({
            code: 'LEGAL_DOCUMENT_DELETE_REQUIRES_WITHDRAWN',
            message: 'Withdraw the legal document before deleting it.',
          });
        }

        const deletedAt = new Date();
        const deleted = await transaction
          .updateTable('legal_documents')
          .set({ deleted_at: deletedAt })
          .where('id', '=', legalDocumentId)
          .where('deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'legal_document.deleted',
          actorUserId: admin.id,
          entityId: legalDocumentId,
          entityType: 'legal_documents',
          nextState: {
            deletedAt: deletedAt.toISOString(),
            status: 'deleted',
          },
          previousState: {
            contentSha256: document.content_sha256,
            documentKey: document.document_key,
            state: event.next_state,
            version: document.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { id: deleted.id, status: 'deleted' };
      },
    );
    return result as unknown as AdminDeletedEntityResponseDto;
  }

  private toContent(content: LegalDocumentContentDto): JsonObject {
    return {
      intro: content.intro.trim(),
      sections: content.sections.map((section) => ({
        ...(section.body ? { body: section.body.trim() } : {}),
        ...(section.bullets
          ? { bullets: section.bullets.map((bullet) => bullet.trim()) }
          : {}),
        heading: section.heading.trim(),
      })),
    };
  }
}
