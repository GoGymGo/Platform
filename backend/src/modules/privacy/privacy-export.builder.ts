import { Injectable } from '@nestjs/common';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import type { ClaimedPrivacyJob } from './privacy-operations.types';
import { PrivacyOperationError } from './privacy-operations.types';

@Injectable()
export class PrivacyExportBuilder {
  constructor(private readonly database: DatabaseService) {}

  build(job: ClaimedPrivacyJob): Promise<Record<string, unknown>> {
    return this.database.connection
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (transaction) => {
        const request = await transaction
          .selectFrom('privacy_requests')
          .select(['id', 'requested_at'])
          .where('id', '=', job.id)
          .where('user_id', '=', job.userId)
          .where('status', '=', 'processing')
          .where('lease_token', '=', job.leaseToken)
          .executeTakeFirst();
        if (!request) {
          throw new PrivacyOperationError('PRIVACY_JOB_LEASE_LOST');
        }

        const account = await transaction
          .selectFrom('users as user')
          .leftJoin('profiles as profile', 'profile.user_id', 'user.id')
          .select([
            'user.id',
            'user.email',
            'user.email_verified',
            'user.roles',
            'user.status',
            'user.created_at',
            'user.updated_at',
            'profile.callsign',
            'profile.public_identity_mode',
            'profile.public_name',
            'profile.privacy_settings',
            'profile.created_at as profile_created_at',
            'profile.updated_at as profile_updated_at',
          ])
          .where('user.id', '=', job.userId)
          .executeTakeFirstOrThrow();

        const profileMedia = await transaction
          .selectFrom('profile_media')
          .select([
            'id',
            'content_type',
            'expected_size_bytes',
            'actual_size_bytes',
            'status',
            'expires_at',
            'completed_at',
            'reviewed_at',
            'object_deleted_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const regionVerifications = await transaction
          .selectFrom('region_verifications as verification')
          .innerJoin(
            'region_policies as policy',
            'policy.id',
            'verification.region_policy_id',
          )
          .select([
            'verification.id',
            'verification.method',
            'verification.status',
            'verification.evidence_metadata',
            'verification.policy_version',
            'verification.decision_reason',
            'verification.verified_at',
            'verification.expires_at',
            'verification.created_at',
            'policy.code as region_code',
            'policy.country_code',
            'policy.subdivision_code',
            'policy.metro_name',
          ])
          .where('verification.user_id', '=', job.userId)
          .orderBy('verification.created_at')
          .execute();

        const enrollments = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'enrollment.competition_id',
          )
          .select([
            'enrollment.id',
            'enrollment.goal_days',
            'enrollment.status',
            'enrollment.enrolled_at',
            'competition.id as competition_id',
            'competition.name as competition_name',
            'competition.month_key',
            'competition.currency',
            'competition.rules_version',
            'competition.starts_at',
            'competition.ends_at',
          ])
          .where('enrollment.user_id', '=', job.userId)
          .orderBy('enrollment.enrolled_at')
          .execute();

        const rulesAcceptances = await transaction
          .selectFrom('competition_rule_acceptances')
          .select([
            'id',
            'competition_id',
            'rules_version',
            'age_eligibility_attested',
            'metadata',
            'accepted_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('accepted_at')
          .execute();

        const accountLegalReceipts = await transaction
          .selectFrom('account_legal_receipt_bundles as bundle')
          .innerJoin(
            'account_legal_receipts as receipt',
            'receipt.receipt_bundle_id',
            'bundle.id',
          )
          .innerJoin(
            'legal_documents as document',
            'document.id',
            'receipt.legal_document_id',
          )
          .select([
            'bundle.id as receipt_bundle_id',
            'bundle.jurisdiction_code',
            'bundle.locale',
            'bundle.bundle_sha256',
            'bundle.accepted_at as bundle_accepted_at',
            'document.document_key',
            'document.version',
            'document.title',
            'document.content_sha256',
            'document.effective_at',
            'receipt.receipt_action',
            'receipt.accepted_at',
          ])
          .where('bundle.user_id', '=', job.userId)
          .orderBy('bundle.accepted_at')
          .orderBy('document.document_key')
          .execute();

        const sessions = await transaction
          .selectFrom('workout_sessions')
          .select([
            'id',
            'competition_id',
            'eligible_date',
            'status',
            'policy_version',
            'client_started_at',
            'started_at',
            'completed_at',
            'verification_summary',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const sessionEvents = await transaction
          .selectFrom('session_events as event')
          .innerJoin(
            'workout_sessions as session',
            'session.id',
            'event.session_id',
          )
          .select([
            'event.id',
            'event.session_id',
            'event.client_event_id',
            'event.event_type',
            'event.occurred_at',
            'event.received_at',
            'event.payload',
          ])
          .where('session.user_id', '=', job.userId)
          .orderBy('event.received_at')
          .execute();

        const demoVerificationCheckpoints = await transaction
          .selectFrom('demo_verification_checkpoints')
          .select([
            'id',
            'provider',
            'region_code',
            'checkpoint_type',
            'outcome',
            'demo',
            'issued_at',
            'expires_at',
            'created_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('issued_at')
          .execute();

        const progress = await transaction
          .selectFrom('competition_progress')
          .select([
            'competition_id',
            'enrollment_id',
            'goal_days',
            'verified_days',
            'category_score',
            'prize_draw_entries',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .execute();

        const entryLedger = await transaction
          .selectFrom('entry_ledger')
          .select([
            'id',
            'competition_id',
            'enrollment_id',
            'reason',
            'source_event_id',
            'verified_days_delta',
            'category_score_delta',
            'prize_draw_entries_delta',
            'policy_version',
            'metadata',
            'created_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const matchHistory = await transaction
          .selectFrom('competition_matches')
          .select([
            'id',
            'competition_id',
            'period_index',
            'period_start_date',
            'period_end_date',
            'status',
            'created_at',
            'settled_at',
          ])
          .where((expression) =>
            expression.or([
              expression('user_a_id', '=', job.userId),
              expression('user_b_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();

        const drawEntries = await transaction
          .selectFrom('draw_entries as entry')
          .innerJoin('competition_draws as draw', 'draw.id', 'entry.draw_id')
          .select([
            'entry.draw_id',
            'entry.enrollment_id',
            'entry.entry_count',
            'entry.snapshot_position',
            'entry.created_at',
            'draw.competition_id',
            'draw.status as draw_status',
            'draw.locked_at',
            'draw.settled_at',
          ])
          .where('entry.user_id', '=', job.userId)
          .orderBy('entry.created_at')
          .execute();

        const winnings = await transaction
          .selectFrom('draw_winners as winner')
          .innerJoin('competition_draws as draw', 'draw.id', 'winner.draw_id')
          .select([
            'winner.id',
            'winner.draw_id',
            'winner.payout_rank',
            'winner.amount_minor',
            'winner.currency',
            'winner.created_at',
            'draw.competition_id',
          ])
          .where('winner.user_id', '=', job.userId)
          .orderBy('winner.created_at')
          .execute();

        const payoutClaims = await transaction
          .selectFrom('payout_claims as claim')
          .leftJoin(
            'payout_payments as payment',
            'payment.payout_claim_id',
            'claim.id',
          )
          .select([
            'claim.id',
            'claim.draw_winner_id',
            'claim.status',
            'claim.provider',
            'claim.amount_minor',
            'claim.currency',
            'claim.approved_at',
            'claim.paid_at',
            'claim.failure_code',
            'claim.created_at',
            'claim.updated_at',
            'payment.provider_status as payment_status',
            'payment.created_at as payment_created_at',
            'payment.updated_at as payment_updated_at',
          ])
          .where('claim.user_id', '=', job.userId)
          .orderBy('claim.created_at')
          .execute();

        const payoutProfiles = await transaction
          .selectFrom('hyperwallet_users')
          .select(['provider_status', 'created_at', 'updated_at'])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const partnerApplications = await transaction
          .selectFrom('partner_applications')
          .select([
            'id',
            'application_type',
            'contact_email',
            'region',
            'payload',
            'status',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const notificationHistory = await transaction
          .selectFrom('notification_deliveries')
          .select([
            'id',
            'template',
            'payload',
            'status',
            'attempt_count',
            'last_error',
            'scheduled_at',
            'sent_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const pushDevices = await transaction
          .selectFrom('push_devices')
          .select([
            'id',
            'provider',
            'platform',
            'enabled',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const privacyRequests = await transaction
          .selectFrom('privacy_requests')
          .select([
            'id',
            'request_type',
            'status',
            'reason',
            'failure_code',
            'requested_at',
            'processing_started_at',
            'completed_at',
            'export_expires_at',
            'result_deleted_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('requested_at')
          .execute();

        const creatorWorkouts = await transaction
          .selectFrom('creator_workouts')
          .select([
            'id',
            'title',
            'creator_name',
            'video_url',
            'thumbnail_url',
            'duration_minutes',
            'workout_style',
            'sponsor_name',
            'region_codes',
            'published',
            'published_at',
            'created_at',
            'updated_at',
          ])
          .where('creator_user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        return {
          account,
          accountLegalReceipts,
          competitionData: {
            demoVerificationCheckpoints,
            drawEntries,
            enrollments,
            entryLedger,
            matchHistory: matchHistory.map((match) => ({
              ...match,
              period_end_date: normalizeDateKey(match.period_end_date),
              period_start_date: normalizeDateKey(match.period_start_date),
            })),
            progress,
            rulesAcceptances,
            sessionEvents,
            sessions: sessions.map((session) => ({
              ...session,
              eligible_date: normalizeDateKey(session.eligible_date),
            })),
            winnings,
          },
          creatorWorkouts,
          deliveryPreferences: { pushDevices },
          generatedAt: new Date().toISOString(),
          notificationHistory,
          partnerApplications,
          payoutData: { payoutClaims, payoutProfiles },
          privacyRequests,
          profileMedia,
          regionVerifications,
          request: {
            id: request.id,
            requestedAt: request.requested_at,
          },
          schemaVersion: 3,
          securityExclusions: [
            'Firebase identifiers and bearer credentials',
            'Push notification tokens',
            'Hyperwallet user, payment, program, and webhook tokens',
            "Other users' identifiers and internal operator case material",
            'Raw device-attestation and reusable QR credentials',
          ],
        };
      });
  }
}
