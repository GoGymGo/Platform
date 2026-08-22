import type { Database } from '../../database/database.types';

type PrivacyDisposition = {
  deletion: 'delete' | 'pseudonymize' | 'retain_integrity' | 'shared';
  export: 'include' | 'minimize' | 'exclude';
};

/**
 * A compile-time exhaustive map of every authoritative table. Adding a table
 * without making an explicit privacy decision fails the API type check.
 */
export const privacyTableDisposition = {
  account_legal_receipt_bundles: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  account_legal_receipts: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  account_verification_consent_events: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  cash_fulfillments: { deletion: 'retain_integrity', export: 'minimize' },
  challenge_contact_invitations: { deletion: 'delete', export: 'minimize' },
  competition_draws: { deletion: 'shared', export: 'exclude' },
  competition_enrollments: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  competition_goal_brackets: { deletion: 'shared', export: 'exclude' },
  competition_gym_locations: { deletion: 'shared', export: 'exclude' },
  competition_matches: {
    deletion: 'retain_integrity',
    export: 'minimize',
  },
  competition_match_participants: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  competition_progress: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  competition_rule_acceptances: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  competition_settlement_inputs: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  competitions: { deletion: 'shared', export: 'exclude' },
  creator_video_submissions: { deletion: 'delete', export: 'include' },
  creator_workout_plans: { deletion: 'delete', export: 'include' },
  creator_workouts: { deletion: 'pseudonymize', export: 'include' },
  draw_entries: { deletion: 'retain_integrity', export: 'include' },
  draw_public_identities: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  draw_reward_catalog_snapshots: { deletion: 'shared', export: 'exclude' },
  draw_reward_slots: { deletion: 'shared', export: 'exclude' },
  entry_ledger: { deletion: 'retain_integrity', export: 'include' },
  friend_requests: { deletion: 'delete', export: 'minimize' },
  friendships: { deletion: 'delete', export: 'minimize' },
  gym_locations: { deletion: 'shared', export: 'minimize' },
  gym_partner_assignments: { deletion: 'delete', export: 'include' },
  gym_qr_credentials: {
    deletion: 'retain_integrity',
    export: 'minimize',
  },
  gym_scan_events: { deletion: 'retain_integrity', export: 'minimize' },
  idempotency_keys: { deletion: 'delete', export: 'exclude' },
  interest_submissions: { deletion: 'delete', export: 'include' },
  landing_intake_source_records: { deletion: 'delete', export: 'exclude' },
  legal_document_events: { deletion: 'shared', export: 'exclude' },
  legal_documents: { deletion: 'shared', export: 'minimize' },
  notification_deliveries: { deletion: 'delete', export: 'minimize' },
  operator_audit_events: {
    deletion: 'retain_integrity',
    export: 'exclude',
  },
  partner_applications: { deletion: 'pseudonymize', export: 'include' },
  partner_competition_proposals: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  privacy_request_events: {
    deletion: 'retain_integrity',
    export: 'minimize',
  },
  privacy_requests: { deletion: 'pseudonymize', export: 'include' },
  profile_media: { deletion: 'delete', export: 'minimize' },
  profiles: { deletion: 'pseudonymize', export: 'include' },
  push_devices: { deletion: 'delete', export: 'minimize' },
  region_policies: { deletion: 'shared', export: 'minimize' },
  region_verifications: { deletion: 'pseudonymize', export: 'include' },
  region_waitlist_entries: { deletion: 'delete', export: 'include' },
  reward_awards: { deletion: 'retain_integrity', export: 'include' },
  reward_catalog_items: { deletion: 'shared', export: 'exclude' },
  reward_coupon_codes: { deletion: 'retain_integrity', export: 'exclude' },
  session_events: { deletion: 'retain_integrity', export: 'minimize' },
  social_challenge_checkins: { deletion: 'delete', export: 'include' },
  social_challenge_members: { deletion: 'delete', export: 'include' },
  social_challenges: { deletion: 'delete', export: 'include' },
  social_relationship_events: {
    deletion: 'retain_integrity',
    export: 'minimize',
  },
  user_blocks: { deletion: 'delete', export: 'minimize' },
  users: { deletion: 'pseudonymize', export: 'include' },
  weekly_challenge_assignment_participants: {
    deletion: 'retain_integrity',
    export: 'include',
  },
  weekly_challenge_requests: {
    deletion: 'retain_integrity',
    export: 'minimize',
  },
  worker_heartbeats: { deletion: 'shared', export: 'exclude' },
  workout_sessions: { deletion: 'retain_integrity', export: 'include' },
} satisfies Record<keyof Database, PrivacyDisposition>;

export const privacyExportSchemaVersion = 16;
