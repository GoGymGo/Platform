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
type DateKey = ColumnType<string, Date | string, Date | string>;
type BigInteger = ColumnType<string, bigint | number | string, never>;
type MutableBigInteger = ColumnType<
  string,
  bigint | number | string,
  bigint | number | string
>;

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
  'device_attestation' | 'face_check' | 'gym_qr_scan' | 'heart_rate_sample';
export type LedgerReason =
  | 'enrollment'
  | 'operator_adjustment'
  | 'perfect_month'
  | 'reversal'
  | 'verified_session'
  | 'weekly_match';
export type DrawStatus = 'cancelled' | 'locked' | 'settled';
export type PayoutClaimStatus =
  | 'action_required'
  | 'cancelled'
  | 'failed'
  | 'paid'
  | 'pending_review'
  | 'processing'
  | 'ready'
  | 'verification_pending';
export type ProviderWebhookState = 'failed' | 'processed' | 'received';
export type PartnerApplicationType = 'creator' | 'gym' | 'sponsor';
export type PartnerApplicationStatus =
  'approved' | 'in_review' | 'rejected' | 'submitted';
export type NotificationDeliveryStatus =
  'cancelled' | 'failed' | 'pending' | 'sent';
export type PrivacyRequestType = 'delete' | 'export';
export type PrivacyRequestStatus =
  'completed' | 'processing' | 'rejected' | 'requested';

export interface UsersTable {
  id: Generated<string>;
  firebase_uid: string;
  email: string | null;
  email_verified: boolean;
  roles: string[];
  status: AccountStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProfilesTable {
  user_id: string;
  callsign: string;
  public_identity_mode: PublicIdentityMode;
  public_name: string | null;
  avatar_object_key: string | null;
  privacy_settings: ColumnType<JsonValue, JsonValue, JsonValue>;
  version: number;
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
  payout_enabled: boolean;
  boundary_version: string;
  policy_version: string;
  boundary: unknown;
  valid_from: Timestamp;
  valid_to: NullableTimestamp;
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
  currency: string;
  rules_version: string;
  rules: ColumnType<JsonValue, JsonValue, JsonValue>;
  minimum_entrants: number;
  entrant_cap: number | null;
  registration_opens_at: Timestamp;
  registration_closes_at: Timestamp;
  starts_at: Timestamp;
  ends_at: Timestamp;
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
}

export interface CompetitionEnrollmentsTable {
  id: Generated<string>;
  competition_id: string;
  user_id: string;
  goal_days: number;
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
  verification_summary: ColumnType<
    JsonValue | null,
    JsonValue | null | undefined,
    JsonValue | null
  >;
  created_at: Timestamp;
  updated_at: Timestamp;
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
  entrant_count: number;
  total_entries: BigInteger;
  locked_at: Timestamp;
  settled_at: NullableTimestamp;
}

export interface DrawEntriesTable {
  draw_id: string;
  user_id: string;
  enrollment_id: string;
  entry_count: number;
  snapshot_position: number;
  created_at: Timestamp;
}

export interface DrawWinnersTable {
  id: Generated<string>;
  draw_id: string;
  user_id: string;
  payout_rank: number;
  amount_minor: BigInteger;
  currency: string;
  created_at: Timestamp;
}

export interface PayoutClaimsTable {
  id: Generated<string>;
  draw_winner_id: string;
  user_id: string;
  status: PayoutClaimStatus;
  provider: 'hyperwallet';
  amount_minor: MutableBigInteger;
  currency: string;
  approved_by_user_id: string | null;
  approved_at: NullableTimestamp;
  paid_at: NullableTimestamp;
  failure_code: string | null;
  version: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface HyperwalletUsersTable {
  id: Generated<string>;
  user_id: string;
  program_token: string;
  provider_user_token: string;
  provider_status: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PayoutPaymentsTable {
  id: Generated<string>;
  payout_claim_id: string;
  client_payment_id: string;
  provider_payment_token: string | null;
  provider_status: string;
  amount_minor: MutableBigInteger;
  currency: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProviderWebhooksTable {
  provider_webhook_token: string;
  provider: 'hyperwallet';
  event_type: string;
  provider_created_on: NullableTimestamp;
  object_token: string | null;
  object_status: string | null;
  payload_hash: string | null;
  normalized_payload: ColumnType<JsonValue, JsonValue, JsonValue>;
  state: ProviderWebhookState;
  attempt_count: number;
  processing_error: string | null;
  received_at: Timestamp;
  processed_at: NullableTimestamp;
}

export interface PayoutStateEventsTable {
  id: Generated<string>;
  payout_claim_id: string;
  previous_status: PayoutClaimStatus | null;
  next_status: PayoutClaimStatus;
  source: string;
  source_event_id: string;
  metadata: ColumnType<JsonValue, JsonValue, never>;
  created_at: Timestamp;
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
  requested_at: Timestamp;
  completed_at: NullableTimestamp;
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
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Database {
  competition_draws: CompetitionDrawsTable;
  competition_enrollments: CompetitionEnrollmentsTable;
  competition_goal_brackets: CompetitionGoalBracketsTable;
  competition_matches: CompetitionMatchesTable;
  competition_progress: CompetitionProgressTable;
  competition_rule_acceptances: CompetitionRuleAcceptancesTable;
  competitions: CompetitionsTable;
  draw_entries: DrawEntriesTable;
  draw_winners: DrawWinnersTable;
  entry_ledger: EntryLedgerTable;
  creator_workouts: CreatorWorkoutsTable;
  hyperwallet_users: HyperwalletUsersTable;
  idempotency_keys: IdempotencyKeysTable;
  operator_audit_events: OperatorAuditEventsTable;
  notification_deliveries: NotificationDeliveriesTable;
  partner_applications: PartnerApplicationsTable;
  payout_claims: PayoutClaimsTable;
  payout_payments: PayoutPaymentsTable;
  payout_state_events: PayoutStateEventsTable;
  privacy_requests: PrivacyRequestsTable;
  profiles: ProfilesTable;
  provider_webhooks: ProviderWebhooksTable;
  push_devices: PushDevicesTable;
  region_policies: RegionPoliciesTable;
  region_verifications: RegionVerificationsTable;
  session_events: SessionEventsTable;
  users: UsersTable;
  workout_sessions: WorkoutSessionsTable;
}
