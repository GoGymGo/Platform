import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transaction } from 'kysely';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DrawsService } from '../draws/draws.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ProfileMediaModerationService } from '../profiles/profile-media-moderation.service';
import { SessionsService } from '../sessions/sessions.service';
import { resolveWorkerHealth } from '../operations/operational-health';
import type {
  DecidePartnerApplicationDto,
  DecideProfileMediaDto,
  DecidePrivacyRequestDto,
  DecideRegionVerificationDto,
  LockDrawDto,
  OperatorActionResponseDto,
  ProfileMediaReviewActionDto,
  SessionEvidenceReviewResponseDto,
  OperatorSystemHealthResponseDto,
  OperatorWorkQueueItemDto,
  SettleDrawDto,
  VerifySessionDto,
} from './dto/operator.dto';

@Injectable()
export class OperatorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService<Environment, true>,
    private readonly draws: DrawsService,
    private readonly profiles: ProfilesService,
    private readonly profileMedia: ProfileMediaModerationService,
    private readonly sessions: SessionsService,
  ) {}

  async getSystemHealth(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorSystemHealthResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.requireOperator(principal, transaction);
        const now = new Date();
        const [
          heartbeat,
          competitionStartsDue,
          notificationsPending,
          paymentsUncertain,
          profileMediaCleanupPending,
          privacyOperationsPending,
          webhooksPending,
        ] = await Promise.all([
          transaction
            .selectFrom('worker_heartbeats')
            .selectAll()
            .where('worker_name', '=', 'operations')
            .executeTakeFirst(),
          transaction
            .selectFrom('competitions')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('status', '=', 'registration')
            .where('starts_at', '<=', now)
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('notification_deliveries')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('status', 'in', ['failed', 'pending'])
            .where('attempt_count', '<', 5)
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('payout_payments')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('provider_status', 'in', [
              'SUBMITTING',
              'SUBMISSION_UNCERTAIN',
            ])
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('profile_media')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('object_deleted_at', 'is', null)
            .where('expires_at', '<=', now)
            .where('status', 'in', [
              'pending_upload',
              'rejected',
              'removed',
              'superseded',
            ])
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('privacy_requests')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('status', '=', 'processing')
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('provider_webhooks')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('state', 'in', ['failed', 'received'])
            .where('attempt_count', '<', 10)
            .executeTakeFirstOrThrow(),
        ]);

        const staleAfterMs = this.config.get('WORKER_STALE_AFTER_MS', {
          infer: true,
        });
        const workerHealth = resolveWorkerHealth(
          heartbeat
            ? {
                lastCompletedAt: heartbeat.last_completed_at,
                lastFailedAt: heartbeat.last_failed_at,
                lastStartedAt: heartbeat.last_started_at,
                status: heartbeat.status,
              }
            : null,
          now,
          staleAfterMs,
        );

        return {
          checkedAt: now.toISOString(),
          database: 'ok',
          queues: {
            competitionStartsDue: Number(competitionStartsDue.count),
            notificationsPending: Number(notificationsPending.count),
            paymentsUncertain: Number(paymentsUncertain.count),
            profileMediaCleanupPending: Number(
              profileMediaCleanupPending.count,
            ),
            privacyOperationsPending: Number(privacyOperationsPending.count),
            webhooksPending: Number(webhooksPending.count),
          },
          worker: {
            heartbeatAgeSeconds:
              workerHealth.heartbeatAgeMs === null
                ? null
                : Math.floor(workerHealth.heartbeatAgeMs / 1_000),
            lastCompletedAt:
              heartbeat?.last_completed_at?.toISOString() ?? null,
            lastFailedAt: heartbeat?.last_failed_at?.toISOString() ?? null,
            lastFailureCode: heartbeat?.last_failure_code ?? null,
            status: workerHealth.status,
          },
        };
      });
  }

  async listWorkQueue(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorWorkQueueItemDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.requireOperator(principal, transaction);
        const [sessions, regions, payouts, partners, privacy, profileMedia] =
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
            transaction
              .selectFrom('profile_media')
              .select(['created_at', 'id', 'status'])
              .where('status', '=', 'pending_review')
              .orderBy('created_at')
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
          ...profileMedia.map((item) => this.queueItem(item, 'profile_media')),
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
      evidenceSnapshotSha256: input.evidenceSnapshotSha256,
      findings: input.findings,
      operatorUserId: operatorId,
      reason: input.reason,
      requestId,
      sessionId,
    });
    return {
      id: sessionId,
      status: verified ? 'verified' : 'already_verified',
    };
  }

  async getSessionEvidenceReview(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<SessionEvidenceReviewResponseDto> {
    await this.getOperatorId(principal);
    return this.sessions.getEvidenceReview(sessionId);
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

  async getProfileMediaReviewAction(
    principal: AuthenticatedPrincipal,
    mediaId: string,
  ): Promise<ProfileMediaReviewActionDto> {
    await this.getOperatorId(principal);
    return this.profileMedia.createReviewAction(mediaId);
  }

  async decideProfileMedia(
    principal: AuthenticatedPrincipal,
    mediaId: string,
    requestId: string,
    input: DecideProfileMediaDto,
  ): Promise<OperatorActionResponseDto> {
    const operatorId = await this.getOperatorId(principal);
    return this.profileMedia.decide({
      decision: input.decision,
      mediaId,
      operatorUserId: operatorId,
      reason: input.reason,
      requestId,
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
    this.profiles.requireVerifiedEmail(user);
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
          if (current.status !== 'requested') {
            throw new ConflictException({
              code: 'PRIVACY_REQUEST_ALREADY_DECIDED',
              message: 'The privacy request is no longer awaiting a decision.',
            });
          }
          await transaction
            .updateTable('privacy_requests')
            .set({
              completed_at: input.nextStatus === 'rejected' ? new Date() : null,
              failure_code: null,
              lease_expires_at: null,
              lease_token: null,
              next_attempt_at: new Date(),
              processing_started_at:
                input.nextStatus === 'processing' ? new Date() : null,
              status: input.nextStatus,
              updated_at: new Date(),
            })
            .where('id', '=', current.id)
            .executeTakeFirstOrThrow();
          await transaction
            .insertInto('privacy_request_events')
            .values({
              metadata: { reasonRecordedInOperatorAudit: true },
              next_status: input.nextStatus,
              previous_status: current.status,
              privacy_request_id: current.id,
              source: 'operator_decision',
              source_event_id: input.requestId,
            })
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
