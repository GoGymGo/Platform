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

export type AccountStatus = 'active' | 'deleted' | 'suspended';
export type PublicIdentityMode = 'alias' | 'private' | 'real_name';
export type RegionVerificationMethod =
  'device_location' | 'manual_review' | 'postal_code';
export type RegionVerificationStatus =
  'approved' | 'expired' | 'pending' | 'rejected';
export type IdempotencyState = 'completed' | 'processing';

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

export interface Database {
  idempotency_keys: IdempotencyKeysTable;
  operator_audit_events: OperatorAuditEventsTable;
  profiles: ProfilesTable;
  region_policies: RegionPoliciesTable;
  region_verifications: RegionVerificationsTable;
  users: UsersTable;
}
