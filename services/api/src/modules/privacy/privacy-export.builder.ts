import { Injectable } from '@nestjs/common';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import type { JsonValue } from '../../database/database.types';
import type { ClaimedPrivacyJob } from './privacy-operations.types';
import { PrivacyOperationError } from './privacy-operations.types';
import { privacyExportSchemaVersion } from './privacy-data-map';

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
          .select(['id', 'processing_started_at', 'requested_at'])
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
            'content_sha256',
            'image_height',
            'image_width',
            'inspection_version',
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
            'bundle.acceptance_context_at',
            'bundle.accepted_at as bundle_accepted_at',
            'document.document_key',
            'document.version',
            'document.title',
            'document.content_sha256',
            'document.effective_at',
            'receipt.receipt_action',
            'receipt.presented_content_sha256',
            'receipt.accepted_at',
          ])
          .where('bundle.user_id', '=', job.userId)
          .orderBy('bundle.accepted_at')
          .orderBy('document.document_key')
          .execute();

        const accountVerificationConsents = await transaction
          .selectFrom('account_verification_consent_events')
          .select([
            'id',
            'consent_key',
            'consent_version',
            'action',
            'created_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .orderBy('id')
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

        const gymScanEvents = await transaction
          .selectFrom('gym_scan_events')
          .select([
            'id',
            'session_id',
            'gym_location_id',
            'credential_version',
            'scan_type',
            'outcome',
            'server_timestamp',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('server_timestamp')
          .orderBy('id')
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
          .orderBy('competition_id')
          .execute();

        const settlementInputs = await transaction
          .selectFrom('competition_settlement_inputs')
          .select([
            'draw_id',
            'competition_id',
            'enrollment_id',
            'goal_days',
            'verified_days',
            'longest_streak',
            'category_score',
            'category_rank',
            'prize_draw_entries',
            'rules_version',
            'snapshot_position',
            'created_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .orderBy('draw_id')
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

        const matchParticipants = await transaction
          .selectFrom('competition_match_participants as participant')
          .innerJoin(
            'competition_matches as match',
            'match.id',
            'participant.match_id',
          )
          .select([
            'participant.match_id',
            'participant.competition_id',
            'participant.period_index',
            'participant.participant_role',
            'participant.active',
            'match.status',
            'match.created_at',
            'match.settled_at',
          ])
          .where('participant.user_id', '=', job.userId)
          .orderBy('match.created_at')
          .orderBy('participant.match_id')
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

        const drawPublicIdentities = await transaction
          .selectFrom('draw_public_identities')
          .select([
            'draw_id',
            'alias',
            'streak_daily',
            'streak_weekly',
            'streak_monthly',
            'streak_yearly',
            'streak_projection_version',
            'created_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .orderBy('draw_id')
          .execute();

        const rewardAwards = await transaction
          .selectFrom('reward_awards as award')
          .innerJoin('competition_draws as draw', 'draw.id', 'award.draw_id')
          .innerJoin('draw_reward_slots as slot', (join) =>
            join
              .onRef('slot.draw_id', '=', 'award.draw_id')
              .onRef('slot.slot_position', '=', 'award.award_rank'),
          )
          .innerJoin('draw_reward_catalog_snapshots as reward', (join) =>
            join
              .onRef('reward.draw_id', '=', 'slot.draw_id')
              .onRef(
                'reward.reward_catalog_item_id',
                '=',
                'slot.reward_catalog_item_id',
              ),
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
            'reward.cash_amount_cents',
            'reward.cash_currency',
          ])
          .where('award.user_id', '=', job.userId)
          .orderBy('award.awarded_at')
          .execute();

        const cashFulfillments = await transaction
          .selectFrom('cash_fulfillments')
          .select([
            'id',
            'reward_award_id',
            'competition_id',
            'amount_cents',
            'currency',
            'fulfilled_at',
            'created_at',
          ])
          .where('winner_user_id', '=', job.userId)
          .orderBy('created_at')
          .orderBy('id')
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
            'scheduled_at',
            'sent_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', job.userId)
          .orderBy('created_at')
          .execute();

        const gymPartnerAssignments = await transaction
          .selectFrom('gym_partner_assignments as assignment')
          .innerJoin(
            'gym_locations as gym',
            'gym.id',
            'assignment.gym_location_id',
          )
          .select([
            'assignment.gym_location_id',
            'assignment.access_level',
            'assignment.active',
            'assignment.created_at',
            'assignment.updated_at',
            'gym.name as gym_name',
          ])
          .where('assignment.user_id', '=', job.userId)
          .orderBy('assignment.created_at')
          .orderBy('assignment.gym_location_id')
          .execute();

        const partnerCompetitionProposals = await transaction
          .selectFrom('partner_competition_proposals as proposal')
          .innerJoin(
            'gym_locations as gym',
            'gym.id',
            'proposal.gym_location_id',
          )
          .select([
            'proposal.competition_id',
            'proposal.gym_location_id',
            'proposal.month_key',
            'proposal.status',
            'proposal.lifecycle_version',
            'proposal.submitted_at',
            'proposal.withdrawn_at',
            'proposal.archived_at',
            'proposal.published_at',
            'proposal.created_at',
            'proposal.updated_at',
            'gym.name as gym_name',
          ])
          .where('proposal.proposed_by_user_id', '=', job.userId)
          .orderBy('proposal.created_at')
          .orderBy('proposal.competition_id')
          .execute();

        const gymCredentialActions = await transaction
          .selectFrom('gym_qr_credentials')
          .select([
            'id',
            'competition_id',
            'gym_location_id',
            'credential_version',
            'status',
            'issued_by_user_id',
            'revoked_by_user_id',
            'issued_at',
            'expires_at',
            'revoked_at',
          ])
          .where((expression) =>
            expression.or([
              expression('issued_by_user_id', '=', job.userId),
              expression('revoked_by_user_id', '=', job.userId),
            ]),
          )
          .orderBy('issued_at')
          .orderBy('id')
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
            'challenge.timezone',
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

        const weeklyChallengeAssignments = await transaction
          .selectFrom('weekly_challenge_assignment_participants as participant')
          .innerJoin(
            'weekly_challenge_requests as request',
            'request.id',
            'participant.request_id',
          )
          .select([
            'participant.request_id',
            'participant.competition_id',
            'participant.period_index',
            'request.goal_days',
            'request.status',
            'request.created_at',
            'request.responded_at',
            'request.accepted_at',
          ])
          .where('participant.user_id', '=', job.userId)
          .orderBy('request.created_at')
          .orderBy('participant.request_id')
          .execute();

        return {
          account,
          accountLegalReceipts,
          accountVerificationConsents,
          competitionData: {
            cashFulfillments,
            drawEntries,
            drawPublicIdentities,
            enrollments,
            entryLedger,
            gymScanEvents,
            matchHistory: matchHistory.map((match) => ({
              ...match,
              period_end_date: normalizeDateKey(match.period_end_date),
              period_start_date: normalizeDateKey(match.period_start_date),
            })),
            matchParticipants,
            progress,
            rulesAcceptances,
            sessionEvents: sessionEvents.map((event) => ({
              ...event,
              payload: minimizePrivacySessionEventPayload(
                event.event_type,
                event.payload,
              ),
            })),
            sessions: sessions.map((session) => ({
              ...session,
              eligible_date: normalizeDateKey(session.eligible_date),
            })),
            settlementInputs,
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
          generatedAt: (
            request.processing_started_at ?? request.requested_at
          ).toISOString(),
          notificationHistory,
          partnerApplications,
          partnerOperations: {
            credentialActions: gymCredentialActions.map(
              ({
                issued_by_user_id: issuedByUserId,
                revoked_by_user_id: revokedByUserId,
                ...credential
              }) => ({
                ...credential,
                accountRoles: [
                  ...(issuedByUserId === job.userId ? ['issuer'] : []),
                  ...(revokedByUserId === job.userId ? ['revoker'] : []),
                ],
              }),
            ),
            gymAssignments: gymPartnerAssignments,
            proposals: partnerCompetitionProposals,
          },
          privacyRequests,
          profileMedia,
          regionalUpdateRequests,
          regionVerifications,
          request: {
            id: request.id,
            requestedAt: request.requested_at,
          },
          schemaVersion: privacyExportSchemaVersion,
          securityExclusions: [
            'Firebase identifiers and bearer credentials',
            'Push notification tokens',
            'Encrypted coupon inventory and unassigned coupon codes',
            "Other users' identifiers and internal operator case material",
            'Raw or hashed device-attestation and reusable QR credentials',
            'Raw contact-invitation destinations, hashes, and invite tokens',
          ],
          socialData: {
            challengeCheckIns: challengeCheckIns.map(
              ({ workout_session_id: workoutSessionId, ...checkIn }) => ({
                ...checkIn,
                eligible_date: normalizeDateKey(checkIn.eligible_date),
                verifiedWorkoutLinked: workoutSessionId !== null,
              }),
            ),
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
            weeklyChallengeAssignments,
          },
        };
      });
  }
}

export function minimizePrivacySessionEventPayload(
  eventType: string,
  payload: JsonValue,
): Record<string, unknown> {
  if (
    eventType === 'heart_rate_sample' &&
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.heartRateBpm === 'number'
  ) {
    return { heartRateBpm: payload.heartRateBpm };
  }
  return {};
}
