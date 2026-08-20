import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Transaction } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type {
  ClaimedPrivacyJob,
  ExpiredPrivacyExportObject,
  PrivacyDeletionContext,
} from './privacy-operations.types';
import { PrivacyOperationError } from './privacy-operations.types';

@Injectable()
export class PrivacyOperationsRepository {
  constructor(private readonly database: DatabaseService) {}

  claimNext(
    now: Date,
    leaseSeconds: number,
  ): Promise<ClaimedPrivacyJob | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const current = await transaction
          .selectFrom('privacy_requests')
          .select([
            'id',
            'user_id',
            'request_type',
            'attempt_count',
            'processing_started_at',
          ])
          .where('status', '=', 'processing')
          .where('next_attempt_at', '<=', now)
          .where((expression) =>
            expression.or([
              expression('lease_expires_at', 'is', null),
              expression('lease_expires_at', '<=', now),
            ]),
          )
          .orderBy('next_attempt_at')
          .orderBy('requested_at')
          .forUpdate()
          .skipLocked()
          .executeTakeFirst();
        if (!current) {
          return null;
        }

        const leaseToken = randomUUID();
        const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
        const claimed = await transaction
          .updateTable('privacy_requests')
          .set({
            attempt_count: sql<number>`attempt_count + 1`,
            failure_code: null,
            lease_expires_at: leaseExpiresAt,
            lease_token: leaseToken,
            processing_started_at: current.processing_started_at ?? now,
            updated_at: now,
          })
          .where('id', '=', current.id)
          .where('status', '=', 'processing')
          .returning('attempt_count')
          .executeTakeFirstOrThrow();

        return {
          attemptCount: claimed.attempt_count,
          id: current.id,
          leaseToken,
          requestType: current.request_type,
          userId: current.user_id,
        };
      });
  }

  async renewLease(
    job: ClaimedPrivacyJob,
    now: Date,
    leaseSeconds: number,
  ): Promise<void> {
    const renewed = await this.database.connection
      .updateTable('privacy_requests')
      .set({
        lease_expires_at: new Date(now.getTime() + leaseSeconds * 1_000),
        updated_at: now,
      })
      .where('id', '=', job.id)
      .where('status', '=', 'processing')
      .where('lease_token', '=', job.leaseToken)
      .where('lease_expires_at', '>', now)
      .returning('id')
      .executeTakeFirst();
    if (!renewed) {
      throw new PrivacyOperationError('PRIVACY_JOB_LEASE_LOST');
    }
  }

  async getDeletionContext(
    job: ClaimedPrivacyJob,
  ): Promise<PrivacyDeletionContext> {
    const user = await this.database.connection
      .selectFrom('privacy_requests as request')
      .innerJoin('users as user', 'user.id', 'request.user_id')
      .leftJoin('profiles as profile', 'profile.user_id', 'user.id')
      .select([
        'user.id as user_id',
        'user.firebase_uid',
        'user.status as user_status',
        'profile.avatar_object_key',
      ])
      .where('request.id', '=', job.id)
      .where('request.status', '=', 'processing')
      .where('request.lease_token', '=', job.leaseToken)
      .executeTakeFirst();
    if (!user) {
      throw new PrivacyOperationError('PRIVACY_JOB_LEASE_LOST');
    }

    const exports = await this.database.connection
      .selectFrom('privacy_requests')
      .select('result_object_key')
      .where('user_id', '=', job.userId)
      .where('request_type', '=', 'export')
      .where('result_object_key', 'is not', null)
      .execute();
    const profileMedia = await this.database.connection
      .selectFrom('profile_media')
      .select(['expires_at', 'object_key'])
      .where('user_id', '=', job.userId)
      .where('object_deleted_at', 'is', null)
      .execute();
    const [openRewardClaim, openCompetition] = await Promise.all([
      this.database.connection
        .selectFrom('reward_awards')
        .select('id')
        .where('user_id', '=', job.userId)
        .where('status', 'in', ['awarded', 'claimed'])
        .executeTakeFirst(),
      this.database.connection
        .selectFrom('competition_enrollments as enrollment')
        .innerJoin(
          'competitions as competition',
          'competition.id',
          'enrollment.competition_id',
        )
        .select('enrollment.id')
        .where('enrollment.user_id', '=', job.userId)
        .where('enrollment.status', '=', 'active')
        .where('competition.status', 'in', [
          'active',
          'registration',
          'settling',
        ])
        .executeTakeFirst(),
    ]);

    return {
      activeMediaUploadExpiresAt:
        profileMedia
          .map((item) => item.expires_at)
          .sort((left, right) => right.getTime() - left.getTime())[0] ?? null,
      avatarObjectKeys: [
        ...new Set([
          ...profileMedia.map((item) => item.object_key),
          ...(user.avatar_object_key ? [user.avatar_object_key] : []),
        ]),
      ],
      exportObjectKeys: exports.flatMap((item) =>
        item.result_object_key ? [item.result_object_key] : [],
      ),
      firebaseUid: user.firebase_uid,
      hasOpenCompetition: Boolean(openCompetition),
      hasOpenRewardClaim: Boolean(openRewardClaim),
      userId: user.user_id,
      userStatus: user.user_status,
    };
  }

  completeExport(
    job: ClaimedPrivacyJob,
    objectKey: string,
    sha256: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const now = new Date();
        const updated = await transaction
          .updateTable('privacy_requests')
          .set({
            completed_at: now,
            export_expires_at: expiresAt,
            failure_code: null,
            lease_expires_at: null,
            lease_token: null,
            result_deleted_at: null,
            result_object_key: objectKey,
            result_sha256: sha256,
            status: 'completed',
            updated_at: now,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', job.id)
          .where('status', '=', 'processing')
          .where('lease_token', '=', job.leaseToken)
          .where('lease_expires_at', '>', now)
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          throw new PrivacyOperationError('PRIVACY_JOB_LEASE_LOST');
        }

        await this.insertEvent(transaction, {
          metadata: {
            expiresAt: expiresAt.toISOString(),
            sha256,
          },
          nextStatus: 'completed',
          previousStatus: 'processing',
          privacyRequestId: job.id,
          source: 'worker_export_completed',
          sourceEventId: job.leaseToken,
        });
      });
  }

  completeDeletion(
    job: ClaimedPrivacyJob,
    pseudonymousFirebaseUid: string,
    pseudonymousCallsign: string,
  ): Promise<void> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const leaseCheckAt = new Date();
        const request = await transaction
          .selectFrom('privacy_requests')
          .select(['id', 'user_id'])
          .where('id', '=', job.id)
          .where('status', '=', 'processing')
          .where('lease_token', '=', job.leaseToken)
          .where('lease_expires_at', '>', leaseCheckAt)
          .forUpdate()
          .executeTakeFirst();
        if (!request) {
          throw new PrivacyOperationError('PRIVACY_JOB_LEASE_LOST');
        }

        const user = await transaction
          .selectFrom('users')
          .select('firebase_uid')
          .where('id', '=', request.user_id)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const now = new Date();

        await transaction
          .updateTable('region_verifications')
          .set({
            decision_reason: null,
            evidence_metadata: {
              redacted: true,
              retainedFor: 'competition_eligibility_audit',
            },
          })
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('competition_rule_acceptances')
          .set({
            metadata: {
              redacted: true,
              retainedFor: 'rules_acceptance_audit',
            },
          })
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('workout_sessions')
          .set({
            verification_summary: {
              redacted: true,
              retainedFor: 'competition_integrity',
            },
            updated_at: now,
          })
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('partner_applications')
          .set({
            contact_email: null,
            payload: { redacted: true },
            updated_at: now,
            user_id: null,
          })
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('creator_workouts')
          .set({
            creator_name: 'Deleted creator',
            creator_user_id: null,
            published: false,
            published_at: null,
            sponsor_name: null,
            thumbnail_url: null,
            updated_at: now,
            video_url: 'about:blank',
          })
          .where('creator_user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('notification_deliveries')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('push_devices')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('region_waitlist_entries')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('idempotency_keys')
          .where('actor_key', '=', `firebase:${user.firebase_uid}`)
          .execute();
        await transaction
          .deleteFrom('profile_media')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('creator_workout_plans')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('creator_video_submissions')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('gym_partner_assignments')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('challenge_contact_invitations')
          .set({ claimed_by_user_id: null })
          .where('claimed_by_user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('challenge_contact_invitations')
          .where('inviter_user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('social_challenges')
          .where('owner_user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('user_blocks')
          .where((expression) =>
            expression.or([
              expression('blocker_user_id', '=', request.user_id),
              expression('blocked_user_id', '=', request.user_id),
            ]),
          )
          .execute();
        await transaction
          .deleteFrom('social_challenge_checkins')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('social_challenge_members')
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .deleteFrom('friend_requests')
          .where((expression) =>
            expression.or([
              expression('requester_user_id', '=', request.user_id),
              expression('recipient_user_id', '=', request.user_id),
            ]),
          )
          .execute();
        await transaction
          .deleteFrom('friendships')
          .where((expression) =>
            expression.or([
              expression('user_a_id', '=', request.user_id),
              expression('user_b_id', '=', request.user_id),
            ]),
          )
          .execute();
        await transaction
          .updateTable('profiles')
          .set({
            avatar_object_key: null,
            callsign: pseudonymousCallsign,
            privacy_settings: { showRegion: false, showStats: false },
            public_identity_mode: 'private',
            public_name: null,
            screen_name: pseudonymousCallsign.replaceAll('-', '_'),
            updated_at: now,
            version: sql<number>`version + 1`,
          })
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('privacy_requests')
          .set({ reason: null, updated_at: now })
          .where('user_id', '=', request.user_id)
          .execute();
        await transaction
          .updateTable('privacy_requests')
          .set({ result_deleted_at: now, updated_at: now })
          .where('user_id', '=', request.user_id)
          .where('request_type', '=', 'export')
          .where('result_object_key', 'is not', null)
          .where('result_deleted_at', 'is', null)
          .execute();
        await transaction
          .updateTable('users')
          .set({
            email: null,
            email_verified: false,
            firebase_uid: pseudonymousFirebaseUid,
            roles: ['user'],
            status: 'deleted',
            updated_at: now,
          })
          .where('id', '=', request.user_id)
          .executeTakeFirstOrThrow();
        const completed = await transaction
          .updateTable('privacy_requests')
          .set({
            completed_at: now,
            failure_code: null,
            lease_expires_at: null,
            lease_token: null,
            status: 'completed',
            updated_at: now,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', request.id)
          .where('status', '=', 'processing')
          .where('lease_token', '=', job.leaseToken)
          .where('lease_expires_at', '>', new Date())
          .returning('id')
          .executeTakeFirst();
        if (!completed) {
          throw new PrivacyOperationError('PRIVACY_JOB_LEASE_LOST');
        }

        await this.insertEvent(transaction, {
          metadata: {
            directIdentifiersRemoved: true,
            retainedRecordClasses: [
              'account_legal_receipts',
              'account_verification_consents',
              'competition_integrity',
              'draw_and_settlement_integrity',
              'fraud_and_eligibility',
              'gym_scan_integrity',
              'reward_award_integrity',
              'operator_audit',
              'social_integrity_audit',
            ],
          },
          nextStatus: 'completed',
          previousStatus: 'processing',
          privacyRequestId: job.id,
          source: 'worker_deletion_completed',
          sourceEventId: job.leaseToken,
        });
      });
  }

  async listExpiredExportObjects(
    now: Date,
    limit: number,
  ): Promise<ExpiredPrivacyExportObject[]> {
    const rows = await this.database.connection
      .selectFrom('privacy_requests')
      .select(['id', 'result_object_key'])
      .where('request_type', '=', 'export')
      .where('status', '=', 'completed')
      .where('export_expires_at', '<=', now)
      .where('result_object_key', 'is not', null)
      .where('result_deleted_at', 'is', null)
      .orderBy('export_expires_at')
      .limit(limit)
      .execute();
    return rows.flatMap((row) =>
      row.result_object_key
        ? [{ objectKey: row.result_object_key, privacyRequestId: row.id }]
        : [],
    );
  }

  markExportObjectDeleted(
    privacyRequestId: string,
    objectKey: string,
    deletedAt: Date,
  ): Promise<boolean> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const updated = await transaction
          .updateTable('privacy_requests')
          .set({ result_deleted_at: deletedAt, updated_at: deletedAt })
          .where('id', '=', privacyRequestId)
          .where('request_type', '=', 'export')
          .where('result_object_key', '=', objectKey)
          .where('result_deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          return false;
        }
        await this.insertEvent(transaction, {
          metadata: { deletedAt: deletedAt.toISOString() },
          nextStatus: 'completed',
          previousStatus: 'completed',
          privacyRequestId,
          source: 'worker_export_expired',
          sourceEventId: 'result-object-expired',
        });
        return true;
      });
  }

  recordFailure(job: ClaimedPrivacyJob, failureCode: string): Promise<void> {
    const retryDelaySeconds = Math.min(
      6 * 60 * 60,
      30 * 2 ** Math.min(job.attemptCount, 9),
    );
    const retryAt = new Date(Date.now() + retryDelaySeconds * 1_000);
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const updated = await transaction
          .updateTable('privacy_requests')
          .set({
            failure_code: failureCode.slice(0, 120),
            lease_expires_at: null,
            lease_token: null,
            next_attempt_at: retryAt,
            updated_at: new Date(),
          })
          .where('id', '=', job.id)
          .where('status', '=', 'processing')
          .where('lease_token', '=', job.leaseToken)
          .where('lease_expires_at', '>', new Date())
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          return;
        }
        await this.insertEvent(transaction, {
          metadata: {
            attemptCount: job.attemptCount,
            failureCode,
            retryAt: retryAt.toISOString(),
          },
          nextStatus: 'processing',
          previousStatus: 'processing',
          privacyRequestId: job.id,
          source: 'worker_attempt_failed',
          sourceEventId: job.leaseToken,
        });
      });
  }

  private async insertEvent(
    transaction: Transaction<Database>,
    event: {
      metadata: JsonObject;
      nextStatus: 'completed' | 'processing';
      previousStatus: 'completed' | 'processing';
      privacyRequestId: string;
      source: string;
      sourceEventId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('privacy_request_events')
      .values({
        metadata: event.metadata,
        next_status: event.nextStatus,
        previous_status: event.previousStatus,
        privacy_request_id: event.privacyRequestId,
        source: event.source,
        source_event_id: event.sourceEventId,
      })
      .executeTakeFirstOrThrow();
  }
}
