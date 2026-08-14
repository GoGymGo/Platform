import type { ColumnType, Generated } from 'kysely';

export type JsonPrimitive = boolean | number | string | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
type DateKey = ColumnType<Date | string, Date | string, Date | string>;
type BigInteger = ColumnType<string, bigint | number | string, never>;

export type AccountStatus = 'active' | 'deleted' | 'suspended';
export type PublicIdentityMode = 'alias' | 'private' | 'real_name';
export type RegionVerificationMethod =
  'device_location' | 'manual_review' | 'postal_code';
export type RegionVerificationStatus =
  'approved' | 'expired' | 'pending' | 'rejected';
export type IdempotencyState = 'completed' | 'processing';
export type CompetitionStatus =
  'active' | 'cancelled' | 'draft' | 'registration' | 'settled' | 'settling';
export type EnrollmentStatus = 'active' | 'disqualified' | 'withdrawn';
export type CompetitionMatchStatus =
  'cancelled' | 'matched' | 'searching' | 'settled';
export type WorkoutSessionStatus =
  'active' | 'cancelled' | 'pending_review' | 'rejected' | 'verified';
export type SessionEventType =
  | 'device_attestation'
  | 'face_check'
  | 'gym_qr_scan'
  | 'heart_rate_sample'
  | 'presence_check';
export type LedgerReason =
  | 'bonus_day'
  | 'category_placement'
  | 'enrollment'
  | 'operator_adjustment'
  | 'perfect_month'
  | 'reversal'
  | 'verified_session'
  | 'weekly_match';
export type DrawStatus = 'cancelled' | 'locked' | 'settled';
export type RewardType = 'cash' | 'coupon' | 'physical';
export type RewardCatalogStatus = 'archived' | 'draft' | 'published';
export type RewardAwardStatus =
  'awarded' | 'cancelled' | 'claimed' | 'fulfilled' | 'redeemed';
export type PartnerApplicationType = 'creator' | 'gym' | 'sponsor';
export type PartnerApplicationStatus =
  'approved' | 'in_review' | 'rejected' | 'submitted';
export type NotificationDeliveryStatus =
  'cancelled' | 'failed' | 'pending' | 'sent';
export type PrivacyRequestType = 'delete' | 'export';
export type PrivacyRequestStatus =
  'completed' | 'processing' | 'rejected' | 'requested';
export type WorkerHeartbeatStatus = 'failed' | 'running' | 'stopping';
export type ProfileMediaStatus =
  | 'approved'
  | 'expired'
  | 'pending_review'
  | 'pending_upload'
  | 'rejected'
  | 'removed'
  | 'superseded';
export type LegalReceiptRequirement = 'accept' | 'acknowledge' | 'none';
export type LegalDocumentState = 'published' | 'withdrawn';
export type LegalReceiptAction = 'accept' | 'acknowledge';
export type VerificationConsentAction = 'granted' | 'withdrawn';
export type FriendRequestStatus =
  'accepted' | 'cancelled' | 'declined' | 'pending';
export type SocialChallengeStatus = 'active' | 'archived' | 'cancelled';
export type SocialChallengeType = 'friend' | 'regional';
export type SocialChallengeActivity =
  | 'cycling'
  | 'fitness_class'
  | 'gym'
  | 'hiking'
  | 'other'
  | 'running'
  | 'walking';
export type SocialChallengeTargetPeriod = 'monthly' | 'weekly';
export type SocialChallengeCheckinSource = 'manual' | 'verified_workout';
export type SocialChallengeMemberRole = 'member' | 'owner';
export type SocialChallengeMemberStatus =
  'accepted' | 'declined' | 'pending' | 'withdrawn';
export type SocialChallengeInvitationSource =
  'contact' | 'friend' | 'owner' | 'regional';
export type ChallengeContactInvitationChannel = 'email' | 'phone';
export type ChallengeContactInvitationStatus =
  'claimed' | 'expired' | 'pending' | 'revoked';
export type WeeklyChallengeRequestStatus =
  'accepted' | 'cancelled' | 'declined' | 'pending';
export type CreatorVideoSubmissionStatus =
  'approved' | 'in_review' | 'rejected' | 'submitted' | 'withdrawn';
export type GymQrCredentialStatus = 'active' | 'revoked';
export type GymScanType = 'early_exit' | 'entry' | 'exit';
export type GymScanOutcome = 'rejected' | 'started' | 'too_early' | 'verified';
export type RegionWaitlistStatus =
  'closed' | 'contacted' | 'launched' | 'waiting';

export interface UsersTable {
  id: Generated<string>;
  firebase_uid: string;
  email: string | null;
  email_verified: boolean;
  roles: string[];
  status: AccountStatus;
  pilot_onboarding_reset_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProfilesTable {
  user_id: string;
  callsign: string;
  screen_name: string;
  public_identity_mode: PublicIdentityMode;
  public_name: string | null;
  avatar_object_key: string | null;
  privacy_settings: ColumnType<JsonValue, JsonValue, JsonValue>;
  version: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FriendRequestsTable {
  id: Generated<string>;
  requester_user_id: string;
  recipient_user_id: string;
  status: FriendRequestStatus;
  responded_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FriendshipsTable {
  user_a_id: string;
  user_b_id: string;
  created_at: Timestamp;
}

export interface UserBlocksTable {
  id: Generated<string>;
  blocker_user_id: string;
  blocked_user_id: string;
  created_at: Timestamp;
}

export type SocialRelationshipEventAction =
  | 'challenge_cancelled'
  | 'challenge_checkin_recorded'
  | 'challenge_contact_link_created'
  | 'challenge_contact_link_redeemed'
  | 'challenge_created'
  | 'challenge_friend_invited'
  | 'challenge_invitation_accepted'
  | 'challenge_invitation_declined'
  | 'challenge_member_withdrawn'
  | 'challenge_regional_joined'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'friend_request_cancelled'
  | 'friendship_removed'
  | 'member_blocked'
  | 'member_unblocked';

export interface SocialRelationshipEventsTable {
  id: Generated<string>;
  actor_user_id: string;
  subject_user_id: string | null;
  action: SocialRelationshipEventAction;
  request_id: string;
  metadata: ColumnType<JsonValue, JsonValue | undefined, never>;
  created_at: Timestamp;
}

export interface ChallengeContactInvitationsTable {
  id: Generated<string>;
  challenge_id: string;
  inviter_user_id: string;
  channel: ChallengeContactInvitationChannel;
  creation_key_hash: string;
  destination_hash: string;
  destination_hint: string;
  delivery_mode: 'link';
  invite_token_hash: string;
  token_version: number;
  status: ChallengeContactInvitationStatus;
  expires_at: Timestamp;
  claimed_by_user_id: string | null;
  created_at: Timestamp;
  claimed_at: NullableTimestamp;
}

export interface SocialChallengesTable {
  id: Generated<string>;
  owner_user_id: string;
  name: string;
  challenge_type: SocialChallengeType;
  creation_key_hash: string | null;
  activity: SocialChallengeActivity;
  activity_label: string;
  description: string | null;
  target_count: number;
  target_period: SocialChallengeTargetPeriod;
  timezone: string;
  start_date: DateKey;
  end_date: DateKey;
  region_policy_id: string | null;
  location_name: string | null;
  scheduled_days: number[];
  scheduled_time_local: string | null;
  participant_limit: number | null;
  status: SocialChallengeStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SocialChallengeCheckinsTable {
  id: Generated<string>;
  challenge_id: string;
  user_id: string;
  eligible_date: DateKey;
  source: SocialChallengeCheckinSource;
  workout_session_id: string | null;
  created_at: Timestamp;
}

export interface SocialChallengeMembersTable {
  challenge_id: string;
  contact_invitation_id: string | null;
  invitation_source: SocialChallengeInvitationSource;
  user_id: string;
  role: SocialChallengeMemberRole;
  status: SocialChallengeMemberStatus;
  invited_by_user_id: string;
  responded_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProfileMediaTable {
  id: Generated<string>;
  user_id: string;
  request_key: string;
  object_key: string;
  content_type: string;
  expected_size_bytes: number;
  actual_size_bytes: number | null;
  storage_generation: string | null;
  status: ProfileMediaStatus;
  expires_at: Timestamp;
  completed_at: NullableTimestamp;
  reviewed_at: NullableTimestamp;
  reviewed_by_user_id: string | null;
  decision_reason: string | null;
  object_deleted_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RegionPoliciesTable {
  id: Generated<string>;
  code: string;
  country_code: string;
  subdivision_code: string;
  metro_name: string;
  currency: string;
  timezone: string;
  language_codes: string[];
  minimum_age: number;
  competition_enabled: boolean;
  boundary_version: string;
  policy_version: string;
  boundary: unknown;
  valid_from: Timestamp;
  valid_to: NullableTimestamp;
  deleted_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface RegionVerificationsTable {
  id: Generated<string>;
  user_id: string;
  region_policy_id: string;
  method: RegionVerificationMethod;
  status: RegionVerificationStatus;
  evidence_metadata: ColumnType<JsonValue, JsonValue, JsonValue>;
  policy_version: string;
  reviewed_by_user_id: string | null;
  decision_reason: string | null;
  verified_at: NullableTimestamp;
  expires_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface IdempotencyKeysTable {
  id: Generated<string>;
  scope: string;
  actor_key: string;
  idempotency_key: string;
  request_hash: string;
  state: IdempotencyState;
  response_code: number | null;
  response_body: ColumnType<
    JsonValue | null,
    JsonValue | null | undefined,
    JsonValue | null
  >;
  expires_at: Timestamp;
  created_at: Timestamp;
  completed_at: NullableTimestamp;
}

export interface OperatorAuditEventsTable {
  id: Generated<string>;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state: ColumnType<
    JsonValue | null,
    JsonValue | null | undefined,
    never
  >;
  next_state: ColumnType<JsonValue | null, JsonValue | null | undefined, never>;
  reason: string;
  request_id: string;
  created_at: Timestamp;
}

export interface CompetitionsTable {
  id: Generated<string>;
  region_policy_id: string;
  month_key: string;
  name: string;
  status: CompetitionStatus;
  rules_version: string;
  rules: ColumnType<JsonValue, JsonValue, JsonValue>;
  configuration_version: Generated<number>;
  minimum_entrants: number;
  entrant_cap: number | null;
  registration_opens_at: Timestamp;
  registration_closes_at: Timestamp;
  starts_at: Timestamp;
  ends_at: Timestamp;
  deleted_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CompetitionGoalBracketsTable {
  competition_id: string;
  goal_days: number;
  label: string;
  created_at: Timestamp;
}

export interface CompetitionRuleAcceptancesTable {
  id: Generated<string>;
  competition_id: string;
  user_id: string;
  rules_version: string;
  age_eligibility_attested: boolean;
  metadata: ColumnType<JsonValue, JsonValue, JsonValue>;
  accepted_at: Timestamp;
  account_legal_receipt_bundle_id: string | null;
}

export interface LegalDocumentsTable {
  id: Generated<string>;
  document_key: string;
  jurisdiction_code: string;
  locale: string;
  version: string;
  title: string;
  content: ColumnType<JsonValue, JsonValue, never>;
  content_sha256: string;
  receipt_requirement: LegalReceiptRequirement;
  effective_at: Timestamp;
  owner_approved_at: NullableTimestamp;
  owner_approved_by_user_id: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >;
  deleted_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface LegalDocumentEventsTable {
  id: Generated<string>;
  legal_document_id: string;
  previous_state: LegalDocumentState | null;
  next_state: LegalDocumentState;
  actor_user_id: string;
  reason: string;
  request_id: string;
  created_at: Timestamp;
}

export interface AccountLegalReceiptBundlesTable {
  id: Generated<string>;
  user_id: string;
  jurisdiction_code: string;
  locale: string;
  bundle_sha256: string;
  acceptance_context_at: Timestamp;
  request_id: string;
  accepted_at: Timestamp;
}

export interface AccountLegalReceiptsTable {
  id: Generated<string>;
  receipt_bundle_id: string;
  legal_document_id: string;
  receipt_action: LegalReceiptAction;
  presented_content_sha256: string;
  accepted_at: Timestamp;
}

export interface AccountVerificationConsentEventsTable {
  id: Generated<string>;
  user_id: string;
  consent_key: 'device_presence_qr_camera';
  consent_version: string;
  action: VerificationConsentAction;
  request_id: string;
  created_at: Timestamp;
}

export interface CompetitionEnrollmentsTable {
  id: Generated<string>;
  competition_id: string;
  user_id: string;
  goal_days: number;
  gym_location_id: string | null;
  gym_credential_version: number | null;
  region_verification_id: string;
  rules_acceptance_id: string;
  status: EnrollmentStatus;
  enrolled_at: Timestamp;
}

export interface CompetitionMatchesTable {
  id: Generated<string>;
  competition_id: string;
  period_index: number;
  period_start_date: DateKey;
  period_end_date: DateKey;
  user_a_id: string;
  user_b_id: string | null;
  status: CompetitionMatchStatus;
  outcome: ColumnType<
    JsonValue | null,
    JsonValue | null | undefined,
    JsonValue | null
  >;
  created_at: Timestamp;
  settled_at: NullableTimestamp;
  weekly_challenge_request_id: string | null;
}

export interface WeeklyChallengeRequestsTable {
  accepted_at: NullableTimestamp;
  id: Generated<string>;
  competition_id: string;
  period_index: number;
  requester_user_id: string;
  recipient_user_id: string;
  goal_days: number;
  status: WeeklyChallengeRequestStatus;
  created_at: Timestamp;
  responded_at: NullableTimestamp;
  cancellation_reason: string | null;
}

export interface WeeklyChallengeAssignmentParticipantsTable {
  request_id: string;
  competition_id: string;
  period_index: number;
  user_id: string;
}

export interface CompetitionMatchParticipantsTable {
  match_id: string;
  competition_id: string;
  period_index: number;
  user_id: string;
  participant_role: 'a' | 'b';
  active: boolean;
}

export interface WorkoutSessionsTable {
  id: Generated<string>;
  competition_id: string;
  enrollment_id: string;
  user_id: string;
  eligible_date: DateKey;
  status: WorkoutSessionStatus;
  policy_version: string;
  client_started_at: NullableTimestamp;
  started_at: Timestamp;
  completed_at: NullableTimestamp;
  gym_location_id: string | null;
  gym_credential_version: number | null;
  expires_at: NullableTimestamp;
  verification_mode: Generated<string>;
  verification_summary: ColumnType<
    JsonValue | null,
    JsonValue | null | undefined,
    JsonValue | null
  >;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GymLocationsTable {
  id: Generated<string>;
  region_policy_id: string;
  name: string;
  address: string;
  coordinates: unknown;
  radius_meters: number;
  active: boolean;
  deleted_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type GymPartnerAccessLevel = 'admin' | 'staff';

export interface GymPartnerAssignmentsTable {
  user_id: string;
  gym_location_id: string;
  access_level: GymPartnerAccessLevel;
  active: boolean;
  assigned_by_user_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PartnerCompetitionProposalsTable {
  competition_id: string;
  gym_location_id: string;
  month_key: string;
  proposed_by_user_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GymQrCredentialsTable {
  id: Generated<string>;
  competition_id: string | null;
  gym_location_id: string;
  credential_version: number;
  token_hash: string;
  qr_payload: string | null;
  status: GymQrCredentialStatus;
  issued_by_user_id: string;
  issued_at: Timestamp;
  expires_at: Timestamp;
  revoked_by_user_id: string | null;
  revoked_at: NullableTimestamp;
  revocation_reason: string | null;
}

export interface CompetitionGymLocationsTable {
  competition_id: string;
  gym_location_id: string;
  created_at: Timestamp;
}

export interface GymScanEventsTable {
  id: Generated<string>;
  session_id: string;
  user_id: string;
  gym_location_id: string;
  credential_version: number;
  client_event_hash: string;
  scan_type: GymScanType;
  outcome: GymScanOutcome;
  server_timestamp: Timestamp;
}

export interface SessionEventsTable {
  id: Generated<string>;
  session_id: string;
  client_event_id: string;
  event_type: SessionEventType;
  occurred_at: Timestamp;
  received_at: Timestamp;
  payload: ColumnType<JsonValue, JsonValue, never>;
}

export interface EntryLedgerTable {
  id: Generated<string>;
  competition_id: string;
  enrollment_id: string;
  user_id: string;
  reason: LedgerReason;
  source_event_id: string;
  verified_days_delta: number;
  category_score_delta: number;
  prize_draw_entries_delta: number;
  policy_version: string;
  metadata: ColumnType<JsonValue, JsonValue, never>;
  created_at: Timestamp;
}

export interface CompetitionProgressTable {
  competition_id: string;
  enrollment_id: string;
  user_id: string;
  goal_days: number;
  verified_days: number;
  category_score: number;
  prize_draw_entries: number;
  updated_at: Timestamp;
}

export interface CompetitionDrawsTable {
  id: Generated<string>;
  competition_id: string;
  status: DrawStatus;
  rules_version: string;
  seed_commitment: string;
  seed_reveal: string | null;
  entrant_snapshot_hash: string;
  scoring_snapshot_hash: string;
  reward_snapshot_hash: string;
  public_result_snapshot_hash: string;
  entrant_count: number;
  total_entries: BigInteger;
  reward_slot_count: number;
  locked_at: Timestamp;
  snapshot_finalized_at: NullableTimestamp;
  settled_at: NullableTimestamp;
}

export interface CompetitionSettlementInputsTable {
  draw_id: string;
  competition_id: string;
  enrollment_id: string;
  user_id: string;
  goal_days: number;
  verified_days: number;
  longest_streak: number;
  category_score: number;
  category_rank: number;
  prize_draw_entries: number;
  tie_break_digest: string;
  rules_version: string;
  snapshot_position: number;
  created_at: Timestamp;
}

export interface DrawEntriesTable {
  draw_id: string;
  user_id: string;
  enrollment_id: string;
  entry_count: number;
  snapshot_position: number;
  created_at: Timestamp;
}

export interface DrawRewardCatalogSnapshotsTable {
  draw_id: string;
  reward_catalog_item_id: string;
  catalog_version: number;
  sponsor_name: string;
  title: string;
  reward_type: RewardType;
  inventory_total: number;
  display_order: number;
  available_from: NullableTimestamp;
  available_until: NullableTimestamp;
  available_slot_count: number;
  created_at: Timestamp;
}

export interface DrawRewardSlotsTable {
  draw_id: string;
  slot_position: number;
  reward_catalog_item_id: string;
  catalog_slot_position: number;
  created_at: Timestamp;
}

export interface DrawPublicIdentitiesTable {
  draw_id: string;
  user_id: string;
  alias: string;
  streak_daily: number;
  streak_weekly: number;
  streak_monthly: number;
  streak_yearly: number;
  streak_projection_version: 'streaks-v1';
  created_at: Timestamp;
}

export interface RewardCatalogItemsTable {
  id: Generated<string>;
  competition_id: string;
  sponsor_name: string;
  title: string;
  description: string;
  reward_type: RewardType;
  status: RewardCatalogStatus;
  image_url: string | null;
  terms_url: string | null;
  claim_url: string | null;
  fulfillment_instructions: string | null;
  inventory_total: number;
  display_order: number;
  available_from: NullableTimestamp;
  available_until: NullableTimestamp;
  version: number;
  deleted_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RewardAwardsTable {
  id: Generated<string>;
  draw_id: string;
  reward_catalog_item_id: string;
  user_id: string;
  award_rank: number;
  status: RewardAwardStatus;
  awarded_at: Timestamp;
  cancelled_at: NullableTimestamp;
  claimed_at: NullableTimestamp;
  fulfilled_at: NullableTimestamp;
  redeemed_at: NullableTimestamp;
  updated_at: Timestamp;
  version: Generated<number>;
}

export interface RewardCouponCodesTable {
  id: Generated<string>;
  reward_catalog_item_id: string;
  encrypted_code: string;
  code_fingerprint: string;
  assigned_award_id: string | null;
  created_at: Timestamp;
  assigned_at: NullableTimestamp;
  redeemed_at: NullableTimestamp;
}

export interface PartnerApplicationsTable {
  id: Generated<string>;
  application_type: PartnerApplicationType;
  user_id: string | null;
  contact_email: string | null;
  region: string;
  payload: ColumnType<JsonValue, JsonValue, JsonValue>;
  dedupe_hash: string;
  status: PartnerApplicationStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RegionWaitlistEntriesTable {
  id: Generated<string>;
  user_id: string | null;
  email: string;
  requested_region: string;
  requested_region_key: string;
  country_code: string | null;
  subdivision_code: string | null;
  source: string;
  status: RegionWaitlistStatus;
  consent_notice_version: string | null;
  consented_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InterestSubmissionsTable {
  id: Generated<string>;
  audience: 'brand' | 'gym_goer';
  email: string;
  full_name: string;
  company_name: string | null;
  website: string | null;
  region: string;
  goal_days: number | null;
  workout_style: string | null;
  partnership_interest: string | null;
  discovery_source: string | null;
  message: string | null;
  consent: boolean;
  source: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CashFulfillmentsTable {
  id: Generated<string>;
  reward_award_id: string;
  competition_id: string;
  winner_user_id: string;
  amount_cents: number;
  currency: string;
  fulfilled_by_user_id: string;
  fulfilled_at: Timestamp;
  fulfillment_note: string;
  created_at: Timestamp;
}

export interface PushDevicesTable {
  id: Generated<string>;
  user_id: string;
  provider: 'expo';
  platform: 'android' | 'ios';
  push_token: string;
  enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface NotificationDeliveriesTable {
  id: Generated<string>;
  user_id: string;
  template: string;
  payload: ColumnType<JsonValue, JsonValue, JsonValue>;
  status: NotificationDeliveryStatus;
  attempt_count: number;
  last_error: string | null;
  lease_expires_at: NullableTimestamp;
  lease_token: string | null;
  scheduled_at: Timestamp;
  sent_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PrivacyRequestsTable {
  id: Generated<string>;
  user_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason: string | null;
  result_object_key: string | null;
  result_deleted_at: NullableTimestamp;
  result_sha256: string | null;
  export_expires_at: NullableTimestamp;
  processing_started_at: NullableTimestamp;
  attempt_count: Generated<number>;
  next_attempt_at: Timestamp;
  lease_token: string | null;
  lease_expires_at: NullableTimestamp;
  failure_code: string | null;
  requested_at: Timestamp;
  completed_at: NullableTimestamp;
  updated_at: Timestamp;
}

export interface PrivacyRequestEventsTable {
  id: Generated<string>;
  privacy_request_id: string;
  previous_status: PrivacyRequestStatus | null;
  next_status: PrivacyRequestStatus;
  source: string;
  source_event_id: string;
  metadata: ColumnType<JsonValue, JsonValue, never>;
  created_at: Timestamp;
}

export interface CreatorWorkoutsTable {
  id: Generated<string>;
  creator_user_id: string | null;
  title: string;
  creator_name: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_minutes: number;
  workout_style: string;
  sponsor_name: string | null;
  region_codes: string[];
  published: boolean;
  published_at: NullableTimestamp;
  deleted_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  version: Generated<number>;
}

export interface CreatorVideoSubmissionsTable {
  id: Generated<string>;
  user_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_minutes: number;
  workout_style: string;
  region_code: string;
  sponsor_disclosure: string | null;
  synthetic_media_disclosed: boolean;
  rights_version: string;
  rights_accepted_at: Timestamp;
  notes: string | null;
  status: CreatorVideoSubmissionStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreatorWorkoutPlansTable {
  id: Generated<string>;
  user_id: string;
  creator_workout_id: string;
  planned_date: DateKey;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WorkerHeartbeatsTable {
  worker_name: string;
  instance_id: string;
  status: WorkerHeartbeatStatus;
  last_started_at: Timestamp;
  last_completed_at: NullableTimestamp;
  last_failed_at: NullableTimestamp;
  last_failure_code: string | null;
  last_result: ColumnType<
    JsonValue | null,
    JsonValue | null | undefined,
    JsonValue | null
  >;
  updated_at: Timestamp;
}

export interface Database {
  account_legal_receipt_bundles: AccountLegalReceiptBundlesTable;
  account_legal_receipts: AccountLegalReceiptsTable;
  account_verification_consent_events: AccountVerificationConsentEventsTable;
  competition_draws: CompetitionDrawsTable;
  competition_gym_locations: CompetitionGymLocationsTable;
  competition_enrollments: CompetitionEnrollmentsTable;
  competition_goal_brackets: CompetitionGoalBracketsTable;
  competition_matches: CompetitionMatchesTable;
  competition_match_participants: CompetitionMatchParticipantsTable;
  weekly_challenge_requests: WeeklyChallengeRequestsTable;
  weekly_challenge_assignment_participants: WeeklyChallengeAssignmentParticipantsTable;
  competition_progress: CompetitionProgressTable;
  competition_settlement_inputs: CompetitionSettlementInputsTable;
  competition_rule_acceptances: CompetitionRuleAcceptancesTable;
  competitions: CompetitionsTable;
  draw_entries: DrawEntriesTable;
  draw_public_identities: DrawPublicIdentitiesTable;
  draw_reward_catalog_snapshots: DrawRewardCatalogSnapshotsTable;
  draw_reward_slots: DrawRewardSlotsTable;
  cash_fulfillments: CashFulfillmentsTable;
  entry_ledger: EntryLedgerTable;
  friend_requests: FriendRequestsTable;
  friendships: FriendshipsTable;
  user_blocks: UserBlocksTable;
  social_relationship_events: SocialRelationshipEventsTable;
  gym_partner_assignments: GymPartnerAssignmentsTable;
  gym_locations: GymLocationsTable;
  gym_qr_credentials: GymQrCredentialsTable;
  gym_scan_events: GymScanEventsTable;
  challenge_contact_invitations: ChallengeContactInvitationsTable;
  creator_workouts: CreatorWorkoutsTable;
  creator_video_submissions: CreatorVideoSubmissionsTable;
  creator_workout_plans: CreatorWorkoutPlansTable;
  idempotency_keys: IdempotencyKeysTable;
  interest_submissions: InterestSubmissionsTable;
  legal_document_events: LegalDocumentEventsTable;
  legal_documents: LegalDocumentsTable;
  operator_audit_events: OperatorAuditEventsTable;
  notification_deliveries: NotificationDeliveriesTable;
  partner_applications: PartnerApplicationsTable;
  partner_competition_proposals: PartnerCompetitionProposalsTable;
  privacy_request_events: PrivacyRequestEventsTable;
  privacy_requests: PrivacyRequestsTable;
  profile_media: ProfileMediaTable;
  profiles: ProfilesTable;
  push_devices: PushDevicesTable;
  region_policies: RegionPoliciesTable;
  region_waitlist_entries: RegionWaitlistEntriesTable;
  region_verifications: RegionVerificationsTable;
  reward_awards: RewardAwardsTable;
  reward_catalog_items: RewardCatalogItemsTable;
  reward_coupon_codes: RewardCouponCodesTable;
  session_events: SessionEventsTable;
  social_challenge_members: SocialChallengeMembersTable;
  social_challenge_checkins: SocialChallengeCheckinsTable;
  social_challenges: SocialChallengesTable;
  users: UsersTable;
  worker_heartbeats: WorkerHeartbeatsTable;
  workout_sessions: WorkoutSessionsTable;
}
