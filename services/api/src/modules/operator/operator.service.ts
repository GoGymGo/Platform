import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql, type RawBuilder, type Transaction } from 'kysely';
import type { Environment } from '../../config/environment';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type {
  Database,
  JsonObject,
  JsonValue,
  PartnerApplicationType,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DrawsService } from '../draws/draws.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ProfileMediaModerationService } from '../profiles/profile-media-moderation.service';
import { SessionsService } from '../sessions/sessions.service';
import { operatorWorkQueueKinds } from './dto/operator.dto';
import {
  AdminAuthorizationService,
  assertOperatorPasswordPrincipal,
} from './admin-authorization.service';
import {
  resolveProviderHealth,
  resolveWorkerHealth,
} from '../operations/operational-health';
import type {
  DecidePartnerApplicationDto,
  DecideCreatorSubmissionDto,
  DecideProfileMediaDto,
  DecidePrivacyRequestDto,
  DecideRegionVerificationDto,
  DrawLockResponseDto,
  LockDrawDto,
  OperatorActionResponseDto,
  ProfileMediaReviewActionDto,
  SessionEvidenceReviewResponseDto,
  OperatorSystemHealthResponseDto,
  OperatorWorkQueueItemDto,
  OperatorWorkQueueDetailDto,
  OperatorWorkQueueKind,
  OperatorWorkQueuePageDto,
  ListOperatorWorkQueueQueryDto,
  SettleDrawDto,
  RejectSessionDto,
  VerifySessionDto,
} from './dto/operator.dto';
import {
  compareOperatorQueueTuple,
  decodeOperatorQueueCursor,
  encodeOperatorQueueCursor,
  type OperatorQueueCursor,
} from './operator-pagination';

interface OperatorActionJson extends JsonObject {
  id: string;
  status: string;
}

interface DrawLockJson extends JsonObject {
  entrantCount: number;
  entrantSnapshotHash: string;
  id: string;
  lockedAt: string;
  publicResultSnapshotHash: string;
  rewardSlotCount: number;
  rewardSnapshotHash: string;
  scoringSnapshotHash: string;
  status: 'locked' | 'settled';
  totalEntries: string;
}

@Injectable()
export class OperatorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService<Environment, true>,
    private readonly draws: DrawsService,
    private readonly profiles: ProfilesService,
    private readonly profileMedia: ProfileMediaModerationService,
    private readonly sessions: SessionsService,
    private readonly adminAuthorization: AdminAuthorizationService,
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
          incompleteSessionsDue,
          notifications,
          privacyOperations,
          profileMediaCleanup,
          socialInvitationsDue,
          workoutSessions,
          regionVerifications,
          partnerApplications,
          privacyRequests,
          profileMedia,
          creatorSubmissions,
          regionWaitlist,
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
            .selectFrom('workout_sessions as session')
            .innerJoin(
              'competitions as competition',
              'competition.id',
              'session.competition_id',
            )
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('session.status', '=', 'active')
            .where((expression) =>
              expression.or([
                expression('session.expires_at', '<=', now),
                sql<boolean>`${sql.ref('competition.ends_at')} + INTERVAL '15 minutes' < ${now}`,
              ]),
            )
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('notification_deliveries')
            .select([
              sql<number>`count(*) filter (
                where status in ('pending', 'failed')
                  and attempt_count < 5
                  and scheduled_at <= ${now}
                  and (lease_expires_at is null or lease_expires_at <= ${now})
              )`.as('pending'),
              sql<number>`count(*) filter (
                where status in ('pending', 'failed')
                  and attempt_count < 5
                  and lease_expires_at > ${now}
              )`.as('leased'),
              sql<number>`count(*) filter (
                where status = 'failed'
                  and attempt_count < 5
                  and scheduled_at > ${now}
              )`.as('retry_scheduled'),
              sql<number>`count(*) filter (
                where status = 'failed' and attempt_count >= 5
              )`.as('exhausted'),
              sql<number>`count(*) filter (
                where status in ('pending', 'failed')
                  and attempt_count < 5
                  and lease_expires_at is not null
                  and lease_expires_at <= ${now}
              )`.as('stale_leases'),
            ])
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('privacy_requests')
            .select([
              sql<number>`count(*) filter (where status = 'processing')`.as(
                'pending',
              ),
              sql<number>`count(*) filter (
                where status = 'processing' and lease_expires_at > ${now}
              )`.as('leased'),
              sql<number>`count(*) filter (
                where status = 'processing'
                  and failure_code is not null
                  and next_attempt_at > ${now}
              )`.as('retry_scheduled'),
              sql<number>`count(*) filter (
                where status = 'processing'
                  and lease_expires_at is not null
                  and lease_expires_at <= ${now}
              )`.as('stale_leases'),
              sql<number>`count(*) filter (
                where status = 'processing' and failure_code is not null
              )`.as('failed'),
            ])
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('profile_media')
            .select([
              sql<number>`count(*) filter (
                where object_deleted_at is null
                  and expires_at <= ${now}
                  and status in ('pending_upload', 'rejected', 'removed', 'superseded')
              )`.as('pending'),
              sql<number>`count(*) filter (
                where object_deleted_at is null
                  and cleanup_lease_expires_at > ${now}
              )`.as('leased'),
              sql<number>`count(*) filter (
                where object_deleted_at is null
                  and cleanup_failure_code is not null
                  and cleanup_next_attempt_at > ${now}
              )`.as('retry_scheduled'),
              sql<number>`count(*) filter (
                where object_deleted_at is null
                  and cleanup_lease_expires_at is not null
                  and cleanup_lease_expires_at <= ${now}
              )`.as('stale_leases'),
              sql<number>`count(*) filter (
                where object_deleted_at is null
                  and cleanup_failure_code is not null
              )`.as('failed'),
            ])
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('challenge_contact_invitations')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('status', '=', 'pending')
            .where('expires_at', '<=', now)
            .executeTakeFirstOrThrow(),
          this.countReviewQueue(transaction, 'workout_sessions', [
            'pending_review',
          ]),
          this.countReviewQueue(transaction, 'region_verifications', [
            'pending',
          ]),
          this.countReviewQueue(transaction, 'partner_applications', [
            'submitted',
            'in_review',
          ]),
          this.countReviewQueue(transaction, 'privacy_requests', ['requested']),
          transaction
            .selectFrom('profile_media')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('status', '=', 'pending_review')
            .where('object_deleted_at', 'is', null)
            .where('inspection_version', '=', 'avatar-image-v1')
            .executeTakeFirstOrThrow()
            .then((item) => Number(item.count)),
          this.countReviewQueue(transaction, 'creator_video_submissions', [
            'submitted',
            'in_review',
          ]),
          this.countReviewQueue(transaction, 'region_waitlist_entries', [
            'waiting',
            'contacted',
            'launched',
          ]),
        ]);

        const staleAfterMs = this.config.get('WORKER_STALE_AFTER_MS', {
          infer: true,
        });
        const workerHealth = resolveWorkerHealth(
          heartbeat
            ? {
                lastCompletedAt: heartbeat.last_completed_at,
                lastFailedAt: heartbeat.last_failed_at,
                lastResult: heartbeat.last_result,
                lastStartedAt: heartbeat.last_started_at,
                status: heartbeat.status,
              }
            : null,
          now,
          staleAfterMs,
        );

        const notificationsExhausted = Number(notifications.exhausted);
        const privacyFailures = Number(privacyOperations.failed);
        const profileMediaFailures = Number(profileMediaCleanup.failed);
        return {
          checkedAt: now.toISOString(),
          database: 'ok',
          providers: {
            notifications: resolveProviderHealth({
              configured: Boolean(
                this.config.get('EXPO_PUSH_ACCESS_TOKEN', { infer: true }),
              ),
              enabled: this.config.get('PUSH_NOTIFICATIONS_ENABLED', {
                infer: true,
              }),
              failureCount: notificationsExhausted,
              service: 'Notification delivery',
            }),
            observability: resolveProviderHealth({
              configured: Boolean(
                this.config.get('OTEL_EXPORTER_OTLP_ENDPOINT', {
                  infer: true,
                }) && this.config.get('OTEL_SERVICE_NAME', { infer: true }),
              ),
              enabled: this.config.get('OTEL_ENABLED', { infer: true }),
              failureCount: 0,
              service: 'Telemetry export',
            }),
            privacy: resolveProviderHealth({
              configured: Boolean(
                this.config.get('PRIVACY_EXPORT_BUCKET', { infer: true }) &&
                this.config.get('PRIVACY_PSEUDONYMIZATION_KEY', {
                  infer: true,
                }),
              ),
              enabled: this.config.get('PRIVACY_OPERATIONS_ENABLED', {
                infer: true,
              }),
              failureCount: privacyFailures,
              service: 'Privacy operations',
            }),
            profileMedia: resolveProviderHealth({
              configured: Boolean(
                this.config.get('PRIVATE_CONTENT_BUCKET', { infer: true }),
              ),
              enabled: this.config.get('PROFILE_MEDIA_ENABLED', {
                infer: true,
              }),
              failureCount: profileMediaFailures,
              service: 'Profile media storage',
            }),
          },
          queues: {
            competitionStartsDue: Number(competitionStartsDue.count),
            incompleteSessionsDue: Number(incompleteSessionsDue.count),
            notificationsExhausted,
            notificationsLeased: Number(notifications.leased),
            notificationsPending: Number(notifications.pending),
            notificationsRetryScheduled: Number(notifications.retry_scheduled),
            notificationsStaleLeases: Number(notifications.stale_leases),
            privacyOperationsLeased: Number(privacyOperations.leased),
            privacyOperationsPending: Number(privacyOperations.pending),
            privacyOperationsRetryScheduled: Number(
              privacyOperations.retry_scheduled,
            ),
            privacyOperationsStaleLeases: Number(
              privacyOperations.stale_leases,
            ),
            profileMediaCleanupLeased: Number(profileMediaCleanup.leased),
            profileMediaCleanupPending: Number(profileMediaCleanup.pending),
            profileMediaCleanupRetryScheduled: Number(
              profileMediaCleanup.retry_scheduled,
            ),
            profileMediaCleanupStaleLeases: Number(
              profileMediaCleanup.stale_leases,
            ),
            socialInvitationsDue: Number(socialInvitationsDue.count),
          },
          reviewQueues: {
            creatorSubmissions,
            partnerApplications,
            privacyRequests,
            profileMedia,
            regionVerifications,
            regionWaitlist,
            workoutSessions,
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
    query: ListOperatorWorkQueueQueryDto,
  ): Promise<OperatorWorkQueuePageDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const operator = await this.requireOperator(principal, transaction);
        const now = new Date();
        const cursor = decodeOperatorQueueCursor(query.cursor);
        if (cursor && query.kind && cursor.kind !== query.kind) {
          throw new BadRequestException({
            code: 'OPERATOR_CURSOR_FILTER_MISMATCH',
            message:
              'The queue cursor does not match the selected review type. Restart from the first page.',
          });
        }
        const pageLimit = Math.min(100, Math.max(1, query.limit ?? 50));
        const kinds = query.kind ? [query.kind] : [...operatorWorkQueueKinds];
        const rows: OperatorWorkQueueItemDto[] = [];

        if (kinds.includes('workout_session')) {
          const sessions = await transaction
            .selectFrom('workout_sessions')
            .select(['created_at', 'id', 'review_version', 'status', 'user_id'])
            .where('status', '=', 'pending_review')
            .where(this.queueAfter('created_at', 'workout_session', cursor))
            .orderBy('created_at')
            .orderBy('id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...sessions.map((item) =>
              this.queueItem(item, 'workout_session', operator.id),
            ),
          );
        }
        if (kinds.includes('region_verification')) {
          const regions = await transaction
            .selectFrom('region_verifications as verification')
            .innerJoin(
              'region_policies as region',
              'region.id',
              'verification.region_policy_id',
            )
            .select([
              'verification.created_at',
              'verification.id',
              'verification.method',
              'verification.review_version',
              'verification.status',
              'verification.user_id',
              'verification.policy_version',
              'region.competition_enabled',
              'region.code as region_code',
              'region.deleted_at',
              'region.policy_version as current_policy_version',
              'region.valid_from',
              'region.valid_to',
            ])
            .where('verification.status', '=', 'pending')
            .where(
              this.queueAfter(
                'verification.created_at',
                'region_verification',
                cursor,
                'verification.id',
              ),
            )
            .orderBy('verification.created_at')
            .orderBy('verification.id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...regions.map((item) => {
              const restriction = this.regionDecisionRestriction(item, now);
              const base = this.queueItem(
                item,
                'region_verification',
                operator.id,
              );
              return {
                ...base,
                decisionAllowed: base.decisionAllowed && !restriction,
                ...(!base.decisionAllowed
                  ? {}
                  : restriction
                    ? { decisionRestrictionCode: restriction }
                    : {}),
                regionCode: item.region_code,
                status: restriction ? 'stuck' : item.status,
                verificationMethod: item.method,
              };
            }),
          );
        }
        if (kinds.includes('partner_application')) {
          const partners = await transaction
            .selectFrom('partner_applications')
            .select(['created_at', 'id', 'review_version', 'status', 'user_id'])
            .where('status', 'in', ['submitted', 'in_review'])
            .where(this.queueAfter('created_at', 'partner_application', cursor))
            .orderBy('created_at')
            .orderBy('id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...partners.map((item) =>
              this.queueItem(item, 'partner_application', operator.id),
            ),
          );
        }
        if (kinds.includes('privacy_request')) {
          const privacy = await transaction
            .selectFrom('privacy_requests')
            .select([
              'failure_code',
              'id',
              'lease_expires_at',
              'next_attempt_at',
              'request_type',
              'requested_at',
              'status',
              'user_id',
              'version',
            ])
            .where('status', 'in', ['requested', 'processing'])
            .where(this.queueAfter('requested_at', 'privacy_request', cursor))
            .orderBy('requested_at')
            .orderBy('id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...privacy.map((item) => ({
              createdAt: item.requested_at.toISOString(),
              ...(item.failure_code
                ? {
                    failureCode: item.failure_code,
                    nextAttemptAt: item.next_attempt_at.toISOString(),
                  }
                : {}),
              id: item.id,
              kind: 'privacy_request' as const,
              decisionAllowed: item.user_id !== operator.id,
              ...(item.user_id === operator.id
                ? { decisionRestrictionCode: 'self_review' as const }
                : {}),
              requestType: item.request_type,
              reviewVersion: item.version,
              status: this.privacyQueueStatus(item, now),
            })),
          );
        }
        if (kinds.includes('profile_media')) {
          const profileMedia = await transaction
            .selectFrom('profile_media')
            .select(['created_at', 'id', 'review_version', 'status', 'user_id'])
            .where('status', '=', 'pending_review')
            .where('object_deleted_at', 'is', null)
            .where('inspection_version', '=', 'avatar-image-v1')
            .where(this.queueAfter('created_at', 'profile_media', cursor))
            .orderBy('created_at')
            .orderBy('id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...profileMedia.map((item) =>
              this.queueItem(item, 'profile_media', operator.id),
            ),
          );
        }
        if (kinds.includes('creator_submission')) {
          const creatorSubmissions = await transaction
            .selectFrom('creator_video_submissions')
            .select(['created_at', 'id', 'review_version', 'status', 'user_id'])
            .where('status', 'in', ['submitted', 'in_review'])
            .where(this.queueAfter('created_at', 'creator_submission', cursor))
            .orderBy('created_at')
            .orderBy('id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...creatorSubmissions.map((item) =>
              this.queueItem(item, 'creator_submission', operator.id),
            ),
          );
        }
        if (kinds.includes('region_waitlist')) {
          const waitlist = await transaction
            .selectFrom('region_waitlist_entries')
            .select(['created_at', 'id', 'review_version', 'status', 'user_id'])
            .where('status', 'in', ['waiting', 'contacted', 'launched'])
            .where(this.queueAfter('created_at', 'region_waitlist', cursor))
            .orderBy('created_at')
            .orderBy('id')
            .limit(pageLimit + 1)
            .execute();
          rows.push(
            ...waitlist.map((item) =>
              this.queueItem(item, 'region_waitlist', operator.id),
            ),
          );
        }

        const ordered = rows.sort(compareOperatorQueueTuple);
        const items = ordered.slice(0, pageLimit);
        const last = items.at(-1);
        return {
          items,
          nextCursor:
            ordered.length > pageLimit && last
              ? encodeOperatorQueueCursor({
                  createdAt: new Date(last.createdAt),
                  id: last.id,
                  kind: last.kind,
                })
              : null,
        };
      });
  }

  async getWorkQueueDetail(
    principal: AuthenticatedPrincipal,
    kindInput: string,
    itemId: string,
  ): Promise<OperatorWorkQueueDetailDto> {
    const kind = this.parseQueueKind(kindInput);
    const operatorId = await this.getOperatorId(principal);
    if (kind === 'workout_session') {
      const session = await this.database.connection
        .selectFrom('workout_sessions')
        .select(['created_at', 'id', 'review_version', 'status', 'user_id'])
        .where('id', '=', itemId)
        .executeTakeFirst();
      this.assertExists(session, kind);
      if (session.status !== 'pending_review') throw this.notReviewable(kind);
      const base = this.queueItem(session, kind, operatorId);
      const evidence = await this.sessions.getEvidenceReview(itemId);
      return {
        ...base,
        allowedDecisions: base.decisionAllowed ? ['verified', 'rejected'] : [],
        facts: [
          { label: 'Competition', value: evidence.competitionId },
          { label: 'Eligible date', value: evidence.eligibleDate },
          { label: 'Duration', value: `${evidence.durationMinutes} minutes` },
          { label: 'Policy', value: evidence.policyVersion },
        ],
        sessionEvidence: evidence,
      };
    }

    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.requireOperator(principal, transaction);
        if (kind === 'region_verification') {
          const item = await transaction
            .selectFrom('region_verifications as verification')
            .innerJoin(
              'region_policies as policy',
              'policy.id',
              'verification.region_policy_id',
            )
            .select([
              'verification.created_at',
              'verification.id',
              'verification.method',
              'verification.policy_version',
              'verification.review_version',
              'verification.status',
              'verification.user_id',
              'policy.boundary_version',
              'policy.code as region_code',
              'policy.competition_enabled',
              'policy.deleted_at',
              'policy.policy_version as current_policy_version',
              'policy.valid_from',
              'policy.valid_to',
            ])
            .where('verification.id', '=', itemId)
            .executeTakeFirst();
          this.assertExists(item, kind);
          const now = new Date();
          if (item.status !== 'pending') throw this.notReviewable(kind);
          const base = this.queueItem(item, kind, operatorId);
          const restriction = this.regionDecisionRestriction(item, now);
          return {
            ...base,
            decisionAllowed: base.decisionAllowed && !restriction,
            ...(!base.decisionAllowed
              ? {}
              : restriction
                ? { decisionRestrictionCode: restriction }
                : {}),
            allowedDecisions:
              base.decisionAllowed && !restriction
                ? ['approved', 'rejected']
                : [],
            facts: [
              { label: 'Region', value: item.region_code },
              { label: 'Method', value: item.method },
              { label: 'Policy', value: item.policy_version },
              { label: 'Boundary', value: item.boundary_version },
            ],
            regionCode: item.region_code,
            status: restriction ? 'stuck' : item.status,
            verificationMethod: item.method,
          };
        }
        if (kind === 'partner_application') {
          const item = await transaction
            .selectFrom('partner_applications')
            .select([
              'application_type',
              'contact_email',
              'created_at',
              'id',
              'payload',
              'region',
              'retention_expires_at',
              'review_version',
              'status',
              'user_id',
            ])
            .where('id', '=', itemId)
            .executeTakeFirst();
          this.assertExists(item, kind);
          if (!['submitted', 'in_review'].includes(item.status)) {
            throw this.notReviewable(kind);
          }
          const base = this.queueItem(item, kind, operatorId);
          return {
            ...base,
            allowedDecisions: !base.decisionAllowed
              ? []
              : item.status === 'submitted'
                ? ['in_review', 'approved', 'rejected']
                : ['approved', 'rejected'],
            facts: [
              { label: 'Application type', value: item.application_type },
              { label: 'Region', value: item.region },
              ...(item.contact_email
                ? [{ label: 'Contact email', value: item.contact_email }]
                : []),
              ...this.partnerApplicationFacts(
                item.application_type,
                item.payload,
              ),
              ...(item.retention_expires_at
                ? [
                    {
                      label: 'Retention expiry',
                      value: item.retention_expires_at.toISOString(),
                    },
                  ]
                : []),
            ],
          };
        }
        if (kind === 'privacy_request') {
          const item = await transaction
            .selectFrom('privacy_requests')
            .select([
              'attempt_count',
              'failure_code',
              'id',
              'lease_expires_at',
              'next_attempt_at',
              'processing_started_at',
              'request_type',
              'requested_at',
              'status',
              'user_id',
              'version',
            ])
            .where('id', '=', itemId)
            .executeTakeFirst();
          this.assertExists(item, kind);
          if (!['requested', 'processing'].includes(item.status)) {
            throw this.notReviewable(kind);
          }
          const status = this.privacyQueueStatus(item, new Date());
          const decisionAllowed = item.user_id !== operatorId;
          return {
            allowedDecisions:
              decisionAllowed && item.status === 'requested'
                ? ['processing', 'rejected']
                : [],
            createdAt: item.requested_at.toISOString(),
            decisionAllowed,
            ...(decisionAllowed
              ? {}
              : { decisionRestrictionCode: 'self_review' as const }),
            failureCode: item.failure_code ?? undefined,
            facts: [
              { label: 'Request type', value: item.request_type },
              { label: 'Attempts', value: String(item.attempt_count) },
              ...(item.processing_started_at
                ? [
                    {
                      label: 'Processing started',
                      value: item.processing_started_at.toISOString(),
                    },
                  ]
                : []),
              ...(item.lease_expires_at
                ? [
                    {
                      label: 'Lease expires',
                      value: item.lease_expires_at.toISOString(),
                    },
                  ]
                : []),
              {
                label: 'Next attempt',
                value: item.next_attempt_at.toISOString(),
              },
            ],
            id: item.id,
            kind,
            nextAttemptAt: item.next_attempt_at.toISOString(),
            requestType: item.request_type,
            reviewVersion: item.version,
            status,
          };
        }
        if (kind === 'profile_media') {
          const item = await transaction
            .selectFrom('profile_media')
            .select([
              'actual_size_bytes',
              'completed_at',
              'content_sha256',
              'content_type',
              'created_at',
              'id',
              'image_height',
              'image_width',
              'inspection_version',
              'review_version',
              'status',
              'user_id',
            ])
            .where('id', '=', itemId)
            .where('object_deleted_at', 'is', null)
            .where('inspection_version', '=', 'avatar-image-v1')
            .executeTakeFirst();
          this.assertExists(item, kind);
          if (item.status !== 'pending_review' || !item.completed_at) {
            throw this.notReviewable(kind);
          }
          const base = this.queueItem(item, kind, operatorId);
          return {
            ...base,
            allowedDecisions: base.decisionAllowed
              ? ['approved', 'rejected']
              : [],
            facts: [
              { label: 'Content type', value: item.content_type },
              {
                label: 'Content length',
                value: String(item.actual_size_bytes ?? 0),
              },
              {
                label: 'Dimensions',
                value: `${item.image_width ?? 0} × ${item.image_height ?? 0}`,
              },
              { label: 'SHA-256', value: item.content_sha256 ?? '' },
              { label: 'Submitted', value: item.completed_at.toISOString() },
            ],
          };
        }
        if (kind === 'creator_submission') {
          const item = await transaction
            .selectFrom('creator_video_submissions')
            .select([
              'created_at',
              'duration_minutes',
              'id',
              'region_code',
              'review_version',
              'rights_accepted_at',
              'rights_version',
              'status',
              'synthetic_media_disclosed',
              'user_id',
              'workout_style',
            ])
            .where('id', '=', itemId)
            .executeTakeFirst();
          this.assertExists(item, kind);
          if (!['submitted', 'in_review'].includes(item.status)) {
            throw this.notReviewable(kind);
          }
          const base = this.queueItem(item, kind, operatorId);
          return {
            ...base,
            allowedDecisions: !base.decisionAllowed
              ? []
              : item.status === 'submitted'
                ? ['in_review', 'approved', 'rejected']
                : ['approved', 'rejected'],
            facts: [
              { label: 'Duration', value: `${item.duration_minutes} minutes` },
              { label: 'Workout style', value: item.workout_style },
              { label: 'Region', value: item.region_code },
              { label: 'Rights version', value: item.rights_version },
              {
                label: 'Rights accepted',
                value: item.rights_accepted_at.toISOString(),
              },
              {
                label: 'Synthetic media disclosed',
                value: item.synthetic_media_disclosed ? 'yes' : 'no',
              },
            ],
          };
        }
        const item = await transaction
          .selectFrom('region_waitlist_entries')
          .selectAll()
          .where('id', '=', itemId)
          .executeTakeFirst();
        this.assertExists(item, kind);
        if (!['waiting', 'contacted', 'launched'].includes(item.status)) {
          throw this.notReviewable(kind);
        }
        const base = this.queueItem(item, kind, operatorId);
        return {
          ...base,
          allowedDecisions: base.decisionAllowed
            ? this.waitlistTransitions(item.status)
            : [],
          facts: [
            { label: 'Email', value: item.email },
            { label: 'Requested region', value: item.requested_region },
            { label: 'Source', value: item.source },
            ...(item.country_code
              ? [{ label: 'Country', value: item.country_code }]
              : []),
            ...(item.subdivision_code
              ? [{ label: 'Subdivision', value: item.subdivision_code }]
              : []),
            ...(item.consented_at
              ? [{ label: 'Consented', value: item.consented_at.toISOString() }]
              : []),
            ...(item.consent_notice_version
              ? [
                  {
                    label: 'Consent notice',
                    value: item.consent_notice_version,
                  },
                ]
              : []),
          ],
        };
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
      authorize: async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
      evidenceSnapshotSha256: input.evidenceSnapshotSha256,
      expectedVersion: input.expectedVersion,
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

  async rejectSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    requestId: string,
    input: RejectSessionDto,
  ): Promise<OperatorActionResponseDto> {
    const operatorId = await this.getOperatorId(principal);
    const rejected = await this.sessions.rejectSession({
      authorize: async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
      evidenceSnapshotSha256: input.evidenceSnapshotSha256,
      expectedVersion: input.expectedVersion,
      findings: input.findings,
      operatorUserId: operatorId,
      reason: input.reason,
      requestId,
      sessionId,
    });
    return {
      id: sessionId,
      status: rejected ? 'rejected' : 'already_rejected',
    };
  }

  async lockDraw(
    principal: AuthenticatedPrincipal,
    requestId: string,
    input: LockDrawDto,
  ): Promise<DrawLockResponseDto> {
    return this.idempotency.execute<DrawLockJson, string>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: {
          competitionId: input.competitionId,
          reason: input.reason,
          seedCommitment: input.seedCommitment,
        },
        responseCode: 200,
        scope: 'operator:draws:lock',
      },
      async (transaction, operatorUserId) => {
        const result = await this.draws.lock(transaction, {
          competitionId: input.competitionId,
          operatorUserId,
          reason: input.reason,
          requestId,
          seedCommitment: input.seedCommitment,
        });
        const { drawId, ...snapshot } = result;
        return { ...snapshot, id: drawId };
      },
      async (transaction) =>
        (await this.adminAuthorization.requireAdmin(principal, transaction)).id,
    );
  }

  async settleDraw(
    principal: AuthenticatedPrincipal,
    drawId: string,
    requestId: string,
    input: SettleDrawDto,
  ): Promise<OperatorActionResponseDto> {
    return this.idempotency.execute<OperatorActionJson, string>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: {
          drawId,
          reason: input.reason,
          seedReveal: input.seedReveal,
        },
        responseCode: 200,
        scope: 'operator:draws:settle',
      },
      async (transaction, operatorUserId) => {
        await this.draws.settle(transaction, {
          drawId,
          operatorUserId,
          reason: input.reason,
          requestId,
          seedReveal: input.seedReveal,
        });
        return { id: drawId, status: 'settled' };
      },
      async (transaction) =>
        (await this.adminAuthorization.requireAdmin(principal, transaction)).id,
    );
  }

  decideRegionVerification(
    principal: AuthenticatedPrincipal,
    verificationId: string,
    requestId: string,
    input: DecideRegionVerificationDto,
  ): Promise<OperatorActionResponseDto> {
    return this.idempotency.execute<OperatorActionJson, string>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: {
          decision: input.decision,
          expectedVersion: input.expectedVersion,
          expiresAt: input.expiresAt ?? null,
          reason: input.reason,
          verificationId,
        },
        responseCode: 200,
        scope: 'operator:region-verification:decision',
      },
      async (transaction, operatorUserId) => {
        const now = new Date();
        const current = await transaction
          .selectFrom('region_verifications as verification')
          .innerJoin(
            'region_policies as policy',
            'policy.id',
            'verification.region_policy_id',
          )
          .select([
            'verification.id',
            'verification.method',
            'verification.policy_version',
            'verification.review_version',
            'verification.status',
            'verification.user_id',
            'policy.deleted_at as policy_deleted_at',
            'policy.competition_enabled',
            'policy.policy_version as current_policy_version',
            'policy.valid_from',
            'policy.valid_to',
          ])
          .where('verification.id', '=', verificationId)
          .forUpdate()
          .executeTakeFirst();
        if (!current) {
          throw new NotFoundException({
            code: 'REGION_VERIFICATION_NOT_FOUND',
            message: 'The region verification was not found.',
          });
        }
        if (current.review_version !== input.expectedVersion) {
          throw new ConflictException({
            code: 'REGION_VERIFICATION_VERSION_CONFLICT',
            message:
              'The region verification changed. Refresh it before deciding.',
          });
        }
        if (current.status !== 'pending') {
          throw new ConflictException({
            code: 'REGION_VERIFICATION_ALREADY_DECIDED',
            message: 'Only a pending region verification can be decided.',
          });
        }
        if (current.user_id === operatorUserId) {
          throw new ForbiddenException({
            code: 'REGION_VERIFICATION_SELF_REVIEW_FORBIDDEN',
            message: 'Operators cannot review their own region verification.',
          });
        }
        if (
          current.method !== 'device_location' ||
          current.policy_deleted_at !== null ||
          !current.competition_enabled ||
          current.valid_from > now ||
          (current.valid_to !== null && current.valid_to <= now) ||
          current.policy_version !== current.current_policy_version
        ) {
          throw new ConflictException({
            code: 'REGION_VERIFICATION_POLICY_STALE',
            message:
              'The pending verification no longer matches an active region policy.',
          });
        }
        const defaultExpiresAt = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1_000,
        );
        const maximumExpiresAt =
          current.valid_to && current.valid_to < defaultExpiresAt
            ? current.valid_to
            : defaultExpiresAt;
        const expiresAt =
          input.decision === 'approved'
            ? input.expiresAt
              ? new Date(input.expiresAt)
              : maximumExpiresAt
            : null;
        if (expiresAt && (expiresAt <= now || expiresAt > maximumExpiresAt)) {
          throw new ConflictException({
            code: 'REGION_VERIFICATION_EXPIRY_INVALID',
            message:
              'Approval expiry must be in the future and within the active policy window.',
          });
        }
        const updated = await transaction
          .updateTable('region_verifications')
          .set({
            decision_reason: input.reason,
            expires_at: expiresAt,
            reviewed_by_user_id: operatorUserId,
            review_version: sql<number>`review_version + 1`,
            status: input.decision,
            verified_at: now,
          })
          .where('id', '=', current.id)
          .where('status', '=', 'pending')
          .where('review_version', '=', input.expectedVersion)
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          throw new ConflictException({
            code: 'REGION_VERIFICATION_VERSION_CONFLICT',
            message:
              'The region verification changed. Refresh it before deciding.',
          });
        }
        await this.audit(transaction, {
          action: 'region_verification.decided',
          actorUserId: operatorUserId,
          entityId: current.id,
          entityType: 'region_verifications',
          nextState: {
            status: input.decision,
            version: input.expectedVersion + 1,
          },
          previousState: {
            status: current.status,
            version: input.expectedVersion,
          },
          reason: input.reason,
          requestId,
        });
        return { id: current.id, status: input.decision };
      },
      async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
    );
  }

  decidePartnerApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    requestId: string,
    input: DecidePartnerApplicationDto,
  ): Promise<OperatorActionResponseDto> {
    return this.idempotency.execute<OperatorActionJson, string>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: {
          applicationId,
          decision: input.decision,
          expectedVersion: input.expectedVersion,
          reason: input.reason,
        },
        scope: 'operator:partner-application:decision',
      },
      async (transaction, operatorUserId) => {
        const current = await transaction
          .selectFrom('partner_applications')
          .select(['id', 'review_version', 'status', 'user_id'])
          .where('id', '=', applicationId)
          .forUpdate()
          .executeTakeFirst();
        this.assertReviewableOwner(
          current,
          operatorUserId,
          'partner_application',
        );
        this.assertReviewTransition(
          current.status,
          input.decision,
          input.expectedVersion,
          current.review_version,
          'PARTNER_APPLICATION',
        );
        const updated = await transaction
          .updateTable('partner_applications')
          .set({
            review_version: sql<number>`review_version + 1`,
            status: input.decision,
            updated_at: new Date(),
          })
          .where('id', '=', current.id)
          .where('review_version', '=', input.expectedVersion)
          .where('status', '=', current.status)
          .returning('id')
          .executeTakeFirst();
        if (!updated) throw this.reviewVersionConflict('PARTNER_APPLICATION');
        await this.auditDecision(transaction, operatorUserId, current.status, {
          action: 'partner_application.decided',
          entityId: current.id,
          entityType: 'partner_applications',
          nextStatus: input.decision,
          nextVersion: input.expectedVersion + 1,
          previousVersion: input.expectedVersion,
          reason: input.reason,
          requestId,
        });
        return { id: current.id, status: input.decision };
      },
      async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
    );
  }

  decideCreatorSubmission(
    principal: AuthenticatedPrincipal,
    submissionId: string,
    requestId: string,
    input: DecideCreatorSubmissionDto,
  ): Promise<OperatorActionResponseDto> {
    return this.idempotency.execute<OperatorActionJson, string>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: {
          decision: input.decision,
          expectedVersion: input.expectedVersion,
          reason: input.reason,
          submissionId,
        },
        scope: 'operator:creator-submission:decision',
      },
      async (transaction, operatorUserId) => {
        const current = await transaction
          .selectFrom('creator_video_submissions')
          .select(['id', 'review_version', 'status', 'user_id'])
          .where('id', '=', submissionId)
          .forUpdate()
          .executeTakeFirst();
        this.assertReviewableOwner(
          current,
          operatorUserId,
          'creator_submission',
        );
        this.assertReviewTransition(
          current.status,
          input.decision,
          input.expectedVersion,
          current.review_version,
          'CREATOR_SUBMISSION',
        );
        const updated = await transaction
          .updateTable('creator_video_submissions')
          .set({
            review_version: sql<number>`review_version + 1`,
            status: input.decision,
            updated_at: new Date(),
          })
          .where('id', '=', current.id)
          .where('review_version', '=', input.expectedVersion)
          .where('status', '=', current.status)
          .returning('id')
          .executeTakeFirst();
        if (!updated) throw this.reviewVersionConflict('CREATOR_SUBMISSION');
        await this.auditDecision(transaction, operatorUserId, current.status, {
          action: 'creator_submission.decided',
          entityId: current.id,
          entityType: 'creator_video_submissions',
          nextStatus: input.decision,
          nextVersion: input.expectedVersion + 1,
          previousVersion: input.expectedVersion,
          reason: input.reason,
          requestId,
        });
        return { id: current.id, status: input.decision };
      },
      async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
    );
  }

  decidePrivacyRequest(
    principal: AuthenticatedPrincipal,
    privacyRequestId: string,
    requestId: string,
    input: DecidePrivacyRequestDto,
  ): Promise<OperatorActionResponseDto> {
    return this.idempotency.execute<OperatorActionJson, string>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: {
          decision: input.decision,
          expectedVersion: input.expectedVersion,
          privacyRequestId,
          reason: input.reason,
        },
        scope: 'operator:privacy-request:decision',
      },
      async (transaction, operatorUserId) => {
        const current = await transaction
          .selectFrom('privacy_requests')
          .select(['id', 'status', 'user_id', 'version'])
          .where('id', '=', privacyRequestId)
          .forUpdate()
          .executeTakeFirst();
        this.assertReviewableOwner(current, operatorUserId, 'privacy_request');
        if (current.version !== input.expectedVersion) {
          throw new ConflictException({
            code: 'PRIVACY_REQUEST_VERSION_CONFLICT',
            message: 'The privacy request changed. Refresh it before deciding.',
          });
        }
        if (current.status !== 'requested') {
          throw new ConflictException({
            code: 'PRIVACY_REQUEST_ALREADY_DECIDED',
            message: 'The privacy request is no longer awaiting a decision.',
          });
        }
        const now = new Date();
        const nextVersion = current.version + 1;
        const updated = await transaction
          .updateTable('privacy_requests')
          .set({
            completed_at: input.decision === 'rejected' ? now : null,
            failure_code: null,
            lease_expires_at: null,
            lease_token: null,
            next_attempt_at: now,
            processing_started_at: input.decision === 'processing' ? now : null,
            status: input.decision,
            updated_at: now,
            version: nextVersion,
          })
          .where('id', '=', current.id)
          .where('status', '=', 'requested')
          .where('version', '=', input.expectedVersion)
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          throw new ConflictException({
            code: 'PRIVACY_REQUEST_VERSION_CONFLICT',
            message: 'The privacy request changed. Refresh it before deciding.',
          });
        }
        await transaction
          .insertInto('privacy_request_events')
          .values({
            metadata: { reasonRecordedInOperatorAudit: true },
            next_status: input.decision,
            previous_status: current.status,
            privacy_request_id: current.id,
            source: 'operator_decision',
            source_event_id: requestId,
          })
          .executeTakeFirstOrThrow();
        await this.audit(transaction, {
          action: 'privacy_request.decided',
          actorUserId: operatorUserId,
          entityId: current.id,
          entityType: 'privacy_requests',
          nextState: { status: input.decision, version: nextVersion },
          previousState: {
            status: current.status,
            version: current.version,
          },
          reason: input.reason,
          requestId,
        });
        return { id: current.id, status: input.decision };
      },
      async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
    );
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
      authorize: async (transaction) =>
        (await this.requireOperator(principal, transaction)).id,
      decision: input.decision,
      expectedVersion: input.expectedVersion,
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

  private async countReviewQueue(
    transaction: Transaction<Database>,
    table:
      | 'creator_video_submissions'
      | 'partner_applications'
      | 'privacy_requests'
      | 'profile_media'
      | 'region_verifications'
      | 'region_waitlist_entries'
      | 'workout_sessions',
    statuses: readonly string[],
  ): Promise<number> {
    const result = await sql<{ count: number | string }>`
      select count(*) as count
      from ${sql.table(table)}
      where status in (${sql.join(statuses.map((status) => sql`${status}`))})
    `.execute(transaction);
    return Number(result.rows[0]?.count ?? 0);
  }

  private async requireOperator(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ) {
    assertOperatorPasswordPrincipal(principal);
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
    await this.adminAuthorization.assertGlobalOperatorIsUnscoped(
      user,
      transaction,
    );
    return user;
  }

  private queueItem(
    item: {
      created_at: Date;
      id: string;
      review_version: number;
      status: string;
      user_id?: string | null;
    },
    kind: OperatorWorkQueueKind,
    operatorId?: string,
  ): OperatorWorkQueueItemDto {
    const selfReview = Boolean(
      operatorId && item.user_id && item.user_id === operatorId,
    );
    return {
      createdAt: item.created_at.toISOString(),
      decisionAllowed: !selfReview,
      ...(selfReview
        ? { decisionRestrictionCode: 'self_review' as const }
        : {}),
      id: item.id,
      kind,
      reviewVersion: item.review_version,
      status: item.status,
    };
  }

  private regionDecisionRestriction(
    item: {
      competition_enabled: boolean;
      current_policy_version: string;
      deleted_at: Date | null;
      method: string;
      policy_version: string;
      valid_from: Date;
      valid_to: Date | null;
    },
    now: Date,
  ): 'stale_policy' | 'unsupported_method' | null {
    if (item.method !== 'device_location') return 'unsupported_method';
    if (
      item.deleted_at !== null ||
      !item.competition_enabled ||
      item.valid_from > now ||
      (item.valid_to !== null && item.valid_to <= now) ||
      item.policy_version !== item.current_policy_version
    ) {
      return 'stale_policy';
    }
    return null;
  }

  private queueAfter(
    createdAtColumn: string,
    kind: OperatorWorkQueueKind,
    cursor: OperatorQueueCursor | null,
    idColumn = 'id',
  ): RawBuilder<boolean> {
    if (!cursor) return sql<boolean>`true`;
    return sql<boolean>`(
      ${sql.ref(createdAtColumn)} > ${cursor.createdAt}
      OR (
        ${sql.ref(createdAtColumn)} = ${cursor.createdAt}
        AND (
          ${kind} > ${cursor.kind}
          OR (${kind} = ${cursor.kind} AND ${sql.ref(idColumn)} > ${cursor.id})
        )
      )
    )`;
  }

  private parseQueueKind(value: string): OperatorWorkQueueKind {
    if (!operatorWorkQueueKinds.includes(value as OperatorWorkQueueKind)) {
      throw new BadRequestException({
        code: 'OPERATOR_QUEUE_KIND_INVALID',
        message: 'That review type is not supported.',
      });
    }
    return value as OperatorWorkQueueKind;
  }

  private assertReviewableOwner(
    item: { user_id: string | null } | null | undefined,
    operatorId: string,
    entityType: string,
  ): asserts item is { user_id: string | null } {
    if (!item) throw this.notFound(entityType);
    if (item.user_id === operatorId) {
      throw new ForbiddenException({
        code: 'OPERATOR_SELF_REVIEW_FORBIDDEN',
        message: 'Operators cannot review their own submitted work.',
      });
    }
  }

  private assertExists<T>(
    item: T | null | undefined,
    entityType: string,
  ): asserts item is T {
    if (!item) throw this.notFound(entityType);
  }

  private notReviewable(entityType: string): ConflictException {
    return new ConflictException({
      code: 'OPERATOR_ITEM_NOT_REVIEWABLE',
      message: `The ${entityType} record is not currently reviewable. Refresh the queue.`,
    });
  }

  private privacyQueueStatus(
    item: {
      failure_code: string | null;
      lease_expires_at: Date | null;
      next_attempt_at: Date;
      status: string;
    },
    now: Date,
  ): string {
    if (item.lease_expires_at && item.lease_expires_at <= now) {
      return 'stale_lease';
    }
    if (item.failure_code) return 'retry_scheduled';
    return item.status;
  }

  private waitlistTransitions(status: string): string[] {
    const transitions: Record<string, string[]> = {
      contacted: ['launched', 'closed'],
      launched: ['closed'],
      waiting: ['contacted', 'closed'],
    };
    return transitions[status] ?? [];
  }

  private partnerApplicationFacts(
    applicationType: PartnerApplicationType,
    payload: JsonValue,
  ): { label: string; value: string }[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw this.invalidPartnerApplicationDetail();
    }
    const read = (key: string, maximumLength: number): string => {
      const value = payload[key];
      if (
        typeof value !== 'string' ||
        value.length < 2 ||
        value.length > maximumLength
      ) {
        throw this.invalidPartnerApplicationDetail();
      }
      return value;
    };
    if (applicationType === 'creator') {
      return [
        { label: 'Creator channel', value: read('channelUrl', 2_048) },
        { label: 'Sample workout', value: read('sampleWorkoutUrl', 2_048) },
        { label: 'Workout style', value: read('workoutStyle', 120) },
      ];
    }
    if (applicationType === 'gym') {
      return [
        { label: 'Gym name', value: read('gymName', 160) },
        { label: 'Manager name', value: read('managerName', 160) },
        { label: 'Gym address', value: read('gymAddress', 500) },
      ];
    }
    return [{ label: 'Company name', value: read('companyName', 160) }];
  }

  private invalidPartnerApplicationDetail(): ConflictException {
    return new ConflictException({
      code: 'PARTNER_APPLICATION_DETAIL_INVALID',
      message:
        'The partner application detail is incomplete. Do not decide it until the record is corrected.',
    });
  }

  private assertReviewTransition(
    currentStatus: string,
    nextStatus: string,
    expectedVersion: number,
    currentVersion: number,
    codePrefix: string,
  ): void {
    if (currentVersion !== expectedVersion) {
      throw this.reviewVersionConflict(codePrefix);
    }
    const transitions: Record<string, string[]> = {
      in_review: ['approved', 'rejected'],
      submitted: ['approved', 'in_review', 'rejected'],
    };
    if (!(transitions[currentStatus] ?? []).includes(nextStatus)) {
      throw new ConflictException({
        code: `${codePrefix}_TRANSITION_INVALID`,
        message:
          'That review decision is not permitted from the current state.',
      });
    }
  }

  private reviewVersionConflict(codePrefix: string): ConflictException {
    return new ConflictException({
      code: `${codePrefix}_VERSION_CONFLICT`,
      message: 'The review item changed. Refresh it before deciding.',
    });
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
      nextVersion: number;
      previousVersion: number;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    return this.audit(transaction, {
      action: input.action,
      actorUserId,
      entityId: input.entityId,
      entityType: input.entityType,
      nextState: { status: input.nextStatus, version: input.nextVersion },
      previousState: {
        status: previousStatus,
        version: input.previousVersion,
      },
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
