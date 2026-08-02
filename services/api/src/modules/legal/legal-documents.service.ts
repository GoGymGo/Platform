import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CurrentLegalDocumentsResponseDto,
  LegalDocumentContentDto,
  LegalDocumentQueryDto,
  LegalDocumentResponseDto,
  LegalReceiptStatusResponseDto,
  RecordLegalReceiptBundleDto,
} from './dto/legal.dto';
import {
  buildJurisdictionHierarchy,
  hashLegalReceiptBundle,
  normalizeJurisdictionCode,
  normalizeLegalLocale,
  requiredAccountLegalDocumentKeys,
} from './legal-document';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

@Injectable()
export class LegalDocumentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  getCurrent(
    query: LegalDocumentQueryDto,
  ): Promise<CurrentLegalDocumentsResponseDto> {
    return this.resolveCurrentBundle(
      this.database.connection,
      query.jurisdictionCode,
      query.locale,
    );
  }

  async getStatus(
    principal: AuthenticatedPrincipal,
    query: LegalDocumentQueryDto,
  ): Promise<LegalReceiptStatusResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const bundle = await this.resolveCurrentBundle(
          transaction,
          query.jurisdictionCode,
          query.locale,
        );
        return this.buildStatus(
          transaction,
          user.id,
          user.pilot_onboarding_reset_at,
          bundle,
        );
      });
  }

  async recordReceiptBundle(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: RecordLegalReceiptBundleDto,
  ): Promise<LegalReceiptStatusResponseDto> {
    const result = await this.idempotency.execute<JsonObject>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope: 'account-legal-receipt-bundles:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const bundle = await this.resolveCurrentBundle(
          transaction,
          input.jurisdictionCode,
          input.locale,
        );
        this.assertConfigured(bundle);
        const requiredDocuments = this.requiredDocuments(bundle);
        this.assertSubmissionMatchesCurrentBundle(
          input,
          bundle,
          requiredDocuments,
        );

        let existingQuery = transaction
          .selectFrom('account_legal_receipt_bundles')
          .select('id')
          .where('user_id', '=', user.id)
          .where('bundle_sha256', '=', bundle.bundleSha256);
        if (user.pilot_onboarding_reset_at) {
          existingQuery = existingQuery.where(
            'accepted_at',
            '>',
            user.pilot_onboarding_reset_at,
          );
        }
        const existing = await existingQuery.executeTakeFirst();
        if (!existing) {
          const now = new Date();
          const receiptBundle = await transaction
            .insertInto('account_legal_receipt_bundles')
            .values({
              accepted_at: now,
              bundle_sha256: bundle.bundleSha256,
              jurisdiction_code: bundle.jurisdictionCode,
              locale: bundle.locale,
              request_id: idempotencyKey,
              user_id: user.id,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          const submittedById = new Map(
            input.documents.map((document) => [document.documentId, document]),
          );
          await transaction
            .insertInto('account_legal_receipts')
            .values(
              requiredDocuments.map((document) => ({
                accepted_at: now,
                legal_document_id: document.id,
                presented_content_sha256: document.contentSha256,
                receipt_action: submittedById.get(document.id)!.action,
                receipt_bundle_id: receiptBundle.id,
              })),
            )
            .execute();
        }

        const status = await this.buildStatus(
          transaction,
          user.id,
          user.pilot_onboarding_reset_at,
          bundle,
        );
        if (!status.complete) {
          throw new ServiceUnavailableException({
            code: 'LEGAL_RECEIPT_BUNDLE_INCOMPLETE',
            message:
              'The legal receipt bundle could not be recorded completely.',
          });
        }
        return status as unknown as JsonObject;
      },
    );
    return result as unknown as LegalReceiptStatusResponseDto;
  }

  async assertCurrentReceiptBundle(
    transaction: Transaction<Database>,
    userId: string,
    expectedJurisdictionCode: string,
    receiptBundleId: string,
  ): Promise<void> {
    const receiptBundle = await transaction
      .selectFrom('account_legal_receipt_bundles')
      .selectAll()
      .where('id', '=', receiptBundleId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!receiptBundle) {
      throw new UnprocessableEntityException({
        code: 'CURRENT_LEGAL_RECEIPT_BUNDLE_REQUIRED',
        message:
          'A current account legal receipt bundle owned by this account is required.',
      });
    }
    const account = await transaction
      .selectFrom('users')
      .select('pilot_onboarding_reset_at')
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    if (
      account.pilot_onboarding_reset_at &&
      receiptBundle.accepted_at <= account.pilot_onboarding_reset_at
    ) {
      throw new ConflictException({
        code: 'LEGAL_RECEIPT_BUNDLE_STALE',
        message:
          'The pilot legal documents must be reviewed again before enrollment.',
      });
    }

    const expectedJurisdiction = normalizeJurisdictionCode(
      expectedJurisdictionCode,
    );
    if (receiptBundle.jurisdiction_code !== expectedJurisdiction) {
      throw new UnprocessableEntityException({
        code: 'LEGAL_RECEIPT_JURISDICTION_MISMATCH',
        message:
          'The legal receipt bundle does not cover the competition jurisdiction.',
      });
    }

    const current = await this.resolveCurrentBundle(
      transaction,
      expectedJurisdiction,
      receiptBundle.locale,
    );
    this.assertConfigured(current);
    if (receiptBundle.bundle_sha256 !== current.bundleSha256) {
      throw new ConflictException({
        code: 'LEGAL_RECEIPT_BUNDLE_STALE',
        message:
          'The legal documents have changed and must be reviewed again before enrollment.',
      });
    }
    const requiredIds = new Set(
      this.requiredDocuments(current).map((document) => document.id),
    );
    const receipts = await transaction
      .selectFrom('account_legal_receipts')
      .select('legal_document_id')
      .where('receipt_bundle_id', '=', receiptBundle.id)
      .execute();
    if (
      receipts.length !== requiredIds.size ||
      receipts.some((receipt) => !requiredIds.has(receipt.legal_document_id))
    ) {
      throw new UnprocessableEntityException({
        code: 'CURRENT_LEGAL_RECEIPT_BUNDLE_REQUIRED',
        message: 'A complete current account legal receipt bundle is required.',
      });
    }
  }

  async resolveCurrentBundle(
    executor: DatabaseExecutor,
    jurisdictionCodeInput: string,
    localeInput: string,
  ): Promise<CurrentLegalDocumentsResponseDto> {
    const jurisdictionCode = normalizeJurisdictionCode(jurisdictionCodeInput);
    const locale = normalizeLegalLocale(localeInput);
    const hierarchy = buildJurisdictionHierarchy(jurisdictionCode);
    const now = new Date();
    const candidates = await executor
      .selectFrom('legal_documents as document')
      .select([
        'document.content',
        'document.content_sha256',
        'document.created_at',
        'document.document_key',
        'document.effective_at',
        'document.id',
        'document.jurisdiction_code',
        'document.locale',
        'document.receipt_requirement',
        'document.title',
        'document.version',
      ])
      .select((expression) =>
        expression
          .selectFrom('legal_document_events as event')
          .select('event.next_state')
          .whereRef('event.legal_document_id', '=', 'document.id')
          .orderBy('event.created_at', 'desc')
          .orderBy('event.id', 'desc')
          .limit(1)
          .as('latest_state'),
      )
      .where('document.jurisdiction_code', 'in', hierarchy)
      .where('document.locale', '=', locale)
      .where('document.effective_at', '<=', now)
      .where('document.owner_approved_at', 'is not', null)
      .execute();

    const selected = new Map<string, (typeof candidates)[number]>();
    candidates
      .filter((document) => document.latest_state === 'published')
      .sort((left, right) => {
        const scopeDifference =
          hierarchy.indexOf(left.jurisdiction_code) -
          hierarchy.indexOf(right.jurisdiction_code);
        if (scopeDifference !== 0) {
          return scopeDifference;
        }
        const effectiveDifference =
          right.effective_at.getTime() - left.effective_at.getTime();
        if (effectiveDifference !== 0) {
          return effectiveDifference;
        }
        const createdDifference =
          right.created_at.getTime() - left.created_at.getTime();
        return createdDifference !== 0
          ? createdDifference
          : right.id.localeCompare(left.id);
      })
      .forEach((document) => {
        if (!selected.has(document.document_key)) {
          selected.set(document.document_key, document);
        }
      });

    const documents = [...selected.values()]
      .sort((left, right) =>
        left.document_key.localeCompare(right.document_key),
      )
      .map<LegalDocumentResponseDto>((document) => ({
        content: document.content as unknown as LegalDocumentContentDto,
        contentSha256: document.content_sha256,
        documentKey: document.document_key,
        effectiveAt: document.effective_at.toISOString(),
        id: document.id,
        jurisdictionCode: document.jurisdiction_code,
        locale: document.locale,
        receiptRequirement: document.receipt_requirement,
        title: document.title,
        version: document.version,
      }));
    const requiredDocuments = documents.filter(
      (document) => document.receiptRequirement !== 'none',
    );
    const configured = requiredAccountLegalDocumentKeys.every((key) =>
      requiredDocuments.some((document) => document.documentKey === key),
    );

    return {
      bundleSha256: hashLegalReceiptBundle({
        documents: requiredDocuments,
        jurisdictionCode,
        locale,
      }),
      configured,
      documents,
      jurisdictionCode,
      locale,
    };
  }

  private assertConfigured(bundle: CurrentLegalDocumentsResponseDto): void {
    if (!bundle.configured) {
      throw new ServiceUnavailableException({
        code: 'LEGAL_DOCUMENTS_NOT_CONFIGURED',
        message:
          'Required account legal documents are not configured for this jurisdiction and locale.',
      });
    }
  }

  private requiredDocuments(
    bundle: CurrentLegalDocumentsResponseDto,
  ): LegalDocumentResponseDto[] {
    return bundle.documents.filter(
      (document) => document.receiptRequirement !== 'none',
    );
  }

  private assertSubmissionMatchesCurrentBundle(
    input: RecordLegalReceiptBundleDto,
    bundle: CurrentLegalDocumentsResponseDto,
    requiredDocuments: LegalDocumentResponseDto[],
  ): void {
    const submitted = new Map(
      input.documents.map((document) => [document.documentId, document]),
    );
    const mismatch =
      input.bundleSha256 !== bundle.bundleSha256 ||
      submitted.size !== requiredDocuments.length ||
      requiredDocuments.some((document) => {
        const receipt = submitted.get(document.id);
        return (
          !receipt ||
          receipt.contentSha256 !== document.contentSha256 ||
          receipt.action !== document.receiptRequirement
        );
      });
    if (mismatch) {
      throw new ConflictException({
        code: 'LEGAL_DOCUMENTS_CHANGED',
        message:
          'The submitted receipt does not match the current legal document bundle.',
      });
    }
  }

  private async buildStatus(
    executor: DatabaseExecutor,
    userId: string,
    onboardingResetAt: Date | null,
    bundle: CurrentLegalDocumentsResponseDto,
  ): Promise<LegalReceiptStatusResponseDto> {
    let acceptedQuery = executor
      .selectFrom('account_legal_receipt_bundles as bundle')
      .select(['bundle.accepted_at', 'bundle.id'])
      .where('bundle.user_id', '=', userId)
      .where('bundle.bundle_sha256', '=', bundle.bundleSha256);
    if (onboardingResetAt) {
      acceptedQuery = acceptedQuery.where(
        'bundle.accepted_at',
        '>',
        onboardingResetAt,
      );
    }
    const accepted = await acceptedQuery.executeTakeFirst();
    const requiredIds = new Set(
      this.requiredDocuments(bundle).map((document) => document.id),
    );
    const receipts = accepted
      ? await executor
          .selectFrom('account_legal_receipts')
          .select('legal_document_id')
          .where('receipt_bundle_id', '=', accepted.id)
          .execute()
      : [];
    const complete =
      bundle.configured &&
      Boolean(accepted) &&
      receipts.length === requiredIds.size &&
      receipts.every((receipt) => requiredIds.has(receipt.legal_document_id));

    return {
      ...bundle,
      acceptedAt: complete ? accepted!.accepted_at.toISOString() : null,
      complete,
      receiptBundleId: complete ? accepted!.id : null,
    };
  }
}
