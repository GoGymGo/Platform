import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Transaction } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DrawsService } from '../draws/draws.service';
import { ProfilesService } from '../profiles/profiles.service';
import { SessionsService } from '../sessions/sessions.service';
import type {
  DecidePartnerApplicationDto,
  DecidePrivacyRequestDto,
  DecideRegionVerificationDto,
  LockDrawDto,
  OperatorActionResponseDto,
  OperatorWorkQueueItemDto,
  SettleDrawDto,
  VerifySessionDto,
} from './dto/operator.dto';

@Injectable()
export class OperatorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly draws: DrawsService,
    private readonly profiles: ProfilesService,
    private readonly sessions: SessionsService,
  ) {}

  async listWorkQueue(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorWorkQueueItemDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.requireOperator(principal, transaction);
        const [sessions, regions, payouts, partners, privacy] =
          await Promise.all([
            transaction
              .selectFrom('workout_sessions')
              .select(['created_at', 'id', 'status'])
              .where('status', '=', 'pending_review')
              .orderBy('created_at')
              .limit(100)
              .execute(),
            transaction
              .selectFrom('region_verifications')
              .select(['created_at', 'id', 'status'])
              .where('status', '=', 'pending')
              .orderBy('created_at')
              .limit(100)
              .execute(),
            transaction
              .selectFrom('payout_claims')
              .select(['created_at', 'id', 'status'])
              .where('status', 'in', [
                'pending_review',
                'action_required',
                'verification_pending',
                'ready',
                'processing',
                'failed',
              ])
              .orderBy('created_at')
              .limit(100)
              .execute(),
            transaction
              .selectFrom('partner_applications')
              .select(['created_at', 'id', 'status'])
              .where('status', 'in', ['submitted', 'in_review'])
              .orderBy('created_at')
              .limit(100)
              .execute(),
            transaction
              .selectFrom('privacy_requests')
              .select(['id', 'requested_at', 'status'])
              .where('status', 'in', ['requested', 'processing'])
              .orderBy('requested_at')
              .limit(100)
              .execute(),
          ]);

        return [
          ...sessions.map((item) => this.queueItem(item, 'workout_session')),
          ...regions.map((item) => this.queueItem(item, 'region_verification')),
          ...payouts.map((item) => this.queueItem(item, 'payout_claim')),
          ...partners.map((item) =>
            this.queueItem(item, 'partner_application'),
          ),
          ...privacy.map((item) => ({
            createdAt: item.requested_at.toISOString(),
            id: item.id,
            kind: 'privacy_request' as const,
            status: item.status,
          })),
        ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
  }

  async verifySession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    requestId: string,
    input: VerifySessionDto,
  ): Promise<OperatorActionResponseDto> {
    const operatorId = await this.getOperatorId(principal);
    const verified = await this.sessions.verifySession({
      operatorUserId: operatorId,
      reason: input.reason,
      requestId,
      sessionId,
      trustedEvidenceSummary: input.trustedEvidenceSummary as JsonObject,
    });
    return {
      id: sessionId,
      status: verified ? 'verified' : 'already_verified',
    };
  }

  async lockDraw(
    principal: AuthenticatedPrincipal,
    requestId: string,
    input: LockDrawDto,
  ): Promise<OperatorActionResponseDto> {
    const operatorId = await this.getOperatorId(principal);
    const result = await this.draws.lock({
      competitionId: input.competitionId,
      operatorUserId: operatorId,
      reason: input.reason,
      requestId,
      seedCommitment: input.seedCommitment,
    });
    return { id: result.drawId, status: 'locked' };
  }

  async settleDraw(
    principal: AuthenticatedPrincipal,
    drawId: string,
    requestId: string,
    input: SettleDrawDto,
  ): Promise<OperatorActionResponseDto> {
    const operatorId = await this.getOperatorId(principal);
    const result = await this.draws.settle({
      drawId,
      operatorUserId: operatorId,
      reason: input.reason,
      requestId,
      seedReveal: input.seedReveal,
    });
    return { id: result.drawId, status: 'settled' };
  }

  decideRegionVerification(
    principal: AuthenticatedPrincipal,
    verificationId: string,
    requestId: string,
    input: DecideRegionVerificationDto,
  ): Promise<OperatorActionResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const operator = await this.requireOperator(principal, transaction);
        const current = await transaction
          .selectFrom('region_verifications')
          .selectAll()
          .where('id', '=', verificationId)
          .forUpdate()
          .executeTakeFirst();
        if (!current) {
          throw new NotFoundException({
            code: 'REGION_VERIFICATION_NOT_FOUND',
            message: 'The region verification was not found.',
          });
        }
        if (current.status !== 'pending') {
          throw new ConflictException({
            code: 'REGION_VERIFICATION_ALREADY_DECIDED',
            message: 'Only a pending region verification can be decided.',
          });
        }
        const expiresAt =
          input.decision === 'approved'
            ? input.expiresAt
              ? new Date(input.expiresAt)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000)
            : null;
        await transaction
          .updateTable('region_verifications')
          .set({
            decision_reason: input.reason,
            expires_at: expiresAt,
            status: input.decision,
            verified_at: new Date(),
          })
          .where('id', '=', current.id)
          .executeTakeFirstOrThrow();
        await this.audit(transaction, {
          action: 'region_verification.decided',
          actorUserId: operator.id,
          entityId: current.id,
          entityType: 'region_verifications',
          nextState: { status: input.decision },
          previousState: { status: current.status },
          reason: input.reason,
          requestId,
        });
        return { id: current.id, status: input.decision };
      });
  }

  decidePartnerApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    requestId: string,
    input: DecidePartnerApplicationDto,
  ): Promise<OperatorActionResponseDto> {
    return this.decideSimpleStatus(principal, {
      action: 'partner_application.decided',
      entityId: applicationId,
      entityType: 'partner_applications',
      nextStatus: input.decision,
      reason: input.reason,
      requestId,
      table: 'partner_applications',
    });
  }

  decidePrivacyRequest(
    principal: AuthenticatedPrincipal,
    privacyRequestId: string,
    requestId: string,
    input: DecidePrivacyRequestDto,
  ): Promise<OperatorActionResponseDto> {
    return this.decideSimpleStatus(principal, {
      action: 'privacy_request.decided',
      entityId: privacyRequestId,
      entityType: 'privacy_requests',
      nextStatus: input.decision,
      reason: input.reason,
      requestId,
      table: 'privacy_requests',
    });
  }

  private async getOperatorId(
    principal: AuthenticatedPrincipal,
  ): Promise<string> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const operator = await this.requireOperator(principal, transaction);
        return operator.id;
      });
  }

  private async requireOperator(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ) {
    const user = await this.profiles.ensureUser(principal, transaction);
    if (
      !user.roles.some((role) =>
        ['admin', 'fraud_operator', 'operator'].includes(role),
      )
    ) {
      throw new ForbiddenException({
        code: 'OPERATOR_REQUIRED',
        message: 'An operator role is required for this action.',
      });
    }
    return user;
  }

  private async decideSimpleStatus(
    principal: AuthenticatedPrincipal,
    input:
      | {
          action: string;
          entityId: string;
          entityType: string;
          nextStatus: 'approved' | 'in_review' | 'rejected';
          reason: string;
          requestId: string;
          table: 'partner_applications';
        }
      | {
          action: string;
          entityId: string;
          entityType: string;
          nextStatus: 'processing' | 'rejected';
          reason: string;
          requestId: string;
          table: 'privacy_requests';
        },
  ): Promise<OperatorActionResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const operator = await this.requireOperator(principal, transaction);
        if (input.table === 'partner_applications') {
          const current = await transaction
            .selectFrom('partner_applications')
            .select(['id', 'status'])
            .where('id', '=', input.entityId)
            .forUpdate()
            .executeTakeFirst();
          if (!current) {
            throw this.notFound(input.entityType);
          }
          await transaction
            .updateTable('partner_applications')
            .set({ status: input.nextStatus, updated_at: new Date() })
            .where('id', '=', current.id)
            .executeTakeFirstOrThrow();
          await this.auditDecision(
            transaction,
            operator.id,
            current.status,
            input,
          );
        } else {
          const current = await transaction
            .selectFrom('privacy_requests')
            .select(['id', 'status'])
            .where('id', '=', input.entityId)
            .forUpdate()
            .executeTakeFirst();
          if (!current) {
            throw this.notFound(input.entityType);
          }
          if (!['requested', 'processing'].includes(current.status)) {
            throw new ConflictException({
              code: 'PRIVACY_REQUEST_ALREADY_DECIDED',
              message: 'The privacy request is already final.',
            });
          }
          await transaction
            .updateTable('privacy_requests')
            .set({ status: input.nextStatus })
            .where('id', '=', current.id)
            .executeTakeFirstOrThrow();
          await this.auditDecision(
            transaction,
            operator.id,
            current.status,
            input,
          );
        }
        return { id: input.entityId, status: input.nextStatus };
      });
  }

  private queueItem(
    item: { created_at: Date; id: string; status: string },
    kind: OperatorWorkQueueItemDto['kind'],
  ): OperatorWorkQueueItemDto {
    return {
      createdAt: item.created_at.toISOString(),
      id: item.id,
      kind,
      status: item.status,
    };
  }

  private notFound(entityType: string): NotFoundException {
    return new NotFoundException({
      code: 'OPERATOR_ENTITY_NOT_FOUND',
      message: `The ${entityType} record was not found.`,
    });
  }

  private auditDecision(
    transaction: Transaction<Database>,
    actorUserId: string,
    previousStatus: string,
    input: {
      action: string;
      entityId: string;
      entityType: string;
      nextStatus: string;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    return this.audit(transaction, {
      action: input.action,
      actorUserId,
      entityId: input.entityId,
      entityType: input.entityType,
      nextState: { status: input.nextStatus },
      previousState: { status: previousStatus },
      reason: input.reason,
      requestId: input.requestId,
    });
  }

  private async audit(
    transaction: Transaction<Database>,
    event: {
      action: string;
      actorUserId: string;
      entityId: string;
      entityType: string;
      nextState: JsonObject;
      previousState: JsonObject;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('operator_audit_events')
      .values({
        action: event.action,
        actor_user_id: event.actorUserId,
        created_at: new Date(),
        entity_id: event.entityId,
        entity_type: event.entityType,
        next_state: event.nextState,
        previous_state: event.previousState,
        reason: event.reason,
        request_id: event.requestId,
      })
      .executeTakeFirstOrThrow();
  }
}
