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
            'profile.screen_name',
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

        const regionalUpdateRequests = await transaction
          .selectFrom('region_waitlist_entries')
          .select([
            'id',
            'requested_region',
            'country_code',
            'subdivision_code',
            'source',
            'status',
            'consent_notice_version',
            'consented_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const enrollments = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'enrollment.competition_id',
          )
          .leftJoin(
            'gym_locations as gym',
            'gym.id',
            'enrollment.gym_location_id',
          )
          .select([
            'enrollment.id',
            'enrollment.goal_days',
            'enrollment.status',
            'enrollment.enrolled_at',
            'competition.id as competition_id',
            'competition.name as competition_name',
            'competition.month_key',
            'competition.rules_version',
            'competition.starts_at',
            'competition.ends_at',
            'gym.id as gym_location_id',
            'gym.name as gym_name',
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

        const rewardAwards = await transaction
          .selectFrom('reward_awards as award')
          .innerJoin('competition_draws as draw', 'draw.id', 'award.draw_id')
          .innerJoin(
            'reward_catalog_items as reward',
            'reward.id',
            'award.reward_catalog_item_id',
          )
          .select([
            'award.id',
            'award.draw_id',
            'award.award_rank',
            'award.status',
            'award.awarded_at',
            'award.claimed_at',
            'award.fulfilled_at',
            'award.redeemed_at',
            'draw.competition_id',
            'reward.sponsor_name',
            'reward.title',
            'reward.reward_type',
          ])
          .where('award.user_id', '=', job.userId)
          .orderBy('award.awarded_at')
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

        const creatorVideoSubmissions = await transaction
          .selectFrom('creator_video_submissions')
          .select([
            'id',
            'title',
            'video_url',
            'thumbnail_url',
            'duration_minutes',
            'workout_style',
            'region_code',
            'sponsor_disclosure',
            'synthetic_media_disclosed',
            'rights_version',
            'rights_accepted_at',
            'notes',
            'status',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();
        const creatorWorkoutPlans = await transaction
          .selectFrom('creator_workout_plans as plan')
          .innerJoin(
            'creator_workouts as workout',
            'workout.id',
            'plan.creator_workout_id',
          )
          .select([
            'plan.id',
            'plan.planned_date',
            'plan.note',
            'plan.created_at',
            'plan.updated_at',
            'workout.title as workout_title',
            'workout.creator_name',
          ])
          .where('plan.user_id', '=', job.userId)
          .orderBy('plan.planned_date')
          .execute();

        const friendRequests = await transaction
          .selectFrom('friend_requests')
          .select([
            'id',
            'requester_user_id',
            'status',
            'responded_at',
            'created_at',
            'updated_at',
          ])
          .where((expression) =>
            expression.or([
              expression('requester_user_id', '=', job.userId),
              expression('recipient_user_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();
        const userBlocks = await transaction
          .selectFrom('user_blocks')
          .select(['blocker_user_id', 'created_at'])
          .where((expression) =>
            expression.or([
              expression('blocker_user_id', '=', job.userId),
              expression('blocked_user_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();
        const socialRelationshipEvents = await transaction
          .selectFrom('social_relationship_events')
          .select([
            'action',
            'actor_user_id',
            'created_at',
            'metadata',
            'subject_user_id',
          ])
          .where((expression) =>
            expression.or([
              expression('actor_user_id', '=', job.userId),
              expression('subject_user_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();
        const friendships = await transaction
          .selectFrom('friendships')
          .select('created_at')
          .where((expression) =>
            expression.or([
              expression('user_a_id', '=', job.userId),
              expression('user_b_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();
        const challengeMemberships = await transaction
          .selectFrom('social_challenge_members as membership')
          .innerJoin(
            'social_challenges as challenge',
            'challenge.id',
            'membership.challenge_id',
          )
          .leftJoin(
            'region_policies as challenge_region',
            'challenge_region.id',
            'challenge.region_policy_id',
          )
          .select([
            'challenge.id',
            'challenge.name',
            'challenge.challenge_type',
            'challenge.activity',
            'challenge.activity_label',
            'challenge.description',
            'challenge.target_count',
            'challenge.target_period',
            'challenge.start_date',
            'challenge.end_date',
            'challenge.location_name',
            'challenge.scheduled_days',
            'challenge.scheduled_time_local',
            'challenge.participant_limit',
            'challenge_region.code as region_code',
            'challenge.status as challenge_status',
            'challenge.owner_user_id',
            'challenge.created_at as challenge_created_at',
            'membership.role',
            'membership.status as membership_status',
            'membership.responded_at',
            'membership.created_at as membership_created_at',
          ])
          .where('membership.user_id', '=', job.userId)
          .orderBy('membership.created_at')
          .execute();
        const challengeCheckIns = await transaction
          .selectFrom('social_challenge_checkins')
          .select([
            'id',
            'challenge_id',
            'eligible_date',
            'source',
            'workout_session_id',
            'created_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('eligible_date')
          .orderBy('created_at')
          .execute();
        const challengeContactInvitations = await transaction
          .selectFrom('challenge_contact_invitations')
          .select([
            'id',
            'challenge_id',
            'channel',
            'destination_hint',
            'status',
            'expires_at',
            'claimed_at',
            'created_at',
          ])
          .where((expression) =>
            expression.or([
              expression('inviter_user_id', '=', job.userId),
              expression('claimed_by_user_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();
        const weeklyChallengeRequests = await transaction
          .selectFrom('weekly_challenge_requests')
          .select([
            'id',
            'competition_id',
            'period_index',
            'goal_days',
            'status',
            'created_at',
            'responded_at',
            'requester_user_id',
          ])
          .where((expression) =>
            expression.or([
              expression('requester_user_id', '=', job.userId),
              expression('recipient_user_id', '=', job.userId),
            ]),
          )
          .orderBy('created_at')
          .execute();

        return {
          account,
          accountLegalReceipts,
          competitionData: {
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
            rewardAwards,
          },
          creatorContent: {
            creatorVideoSubmissions,
            creatorWorkoutPlans: creatorWorkoutPlans.map((plan) => ({
              ...plan,
              planned_date: normalizeDateKey(plan.planned_date),
            })),
          },
          creatorWorkouts,
          deliveryPreferences: { pushDevices },
          generatedAt: new Date().toISOString(),
          notificationHistory,
          partnerApplications,
          privacyRequests,
          profileMedia,
          regionalUpdateRequests,
          regionVerifications,
          request: {
            id: request.id,
            requestedAt: request.requested_at,
          },
          schemaVersion: 9,
          securityExclusions: [
            'Firebase identifiers and bearer credentials',
            'Push notification tokens',
            'Encrypted coupon inventory and unassigned coupon codes',
            "Other users' identifiers and internal operator case material",
            'Raw device-attestation and reusable QR credentials',
            'Raw contact-invitation destinations, hashes, and invite tokens',
          ],
          socialData: {
            challengeCheckIns: challengeCheckIns.map((checkIn) => ({
              ...checkIn,
              eligible_date: normalizeDateKey(checkIn.eligible_date),
            })),
            challengeContactInvitations: challengeContactInvitations.map(
              (invitation) => ({
                ...invitation,
                status:
                  invitation.status === 'pending' &&
                  invitation.expires_at <= new Date()
                    ? 'expired'
                    : invitation.status,
              }),
            ),
            challengeMemberships: challengeMemberships.map(
              ({ owner_user_id: ownerUserId, ...membership }) => ({
                ...membership,
                end_date: normalizeDateKey(membership.end_date),
                ownedByAccount: ownerUserId === job.userId,
                start_date: normalizeDateKey(membership.start_date),
              }),
            ),
            friendRequests: friendRequests.map(
              ({ requester_user_id: requesterUserId, ...request }) => ({
                ...request,
                direction:
                  requesterUserId === job.userId ? 'outgoing' : 'incoming',
              }),
            ),
            friendships,
            relationshipEvents: socialRelationshipEvents.map(
              ({
                actor_user_id: actorUserId,
                subject_user_id: subjectUserId,
                ...event
              }) => ({
                ...event,
                accountRole:
                  actorUserId === job.userId
                    ? 'actor'
                    : subjectUserId === job.userId
                      ? 'subject'
                      : 'unrelated',
              }),
            ),
            blocks: userBlocks.map(
              ({ blocker_user_id: blockerUserId, ...block }) => ({
                ...block,
                direction:
                  blockerUserId === job.userId ? 'outgoing' : 'incoming',
              }),
            ),
            weeklyChallengeRequests: weeklyChallengeRequests.map(
              ({ requester_user_id: requesterUserId, ...weeklyRequest }) => ({
                ...weeklyRequest,
                direction:
                  requesterUserId === job.userId ? 'outgoing' : 'incoming',
              }),
            ),
          },
        };
      });
  }
}
