import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createType('gym_qr_credential_status', ['active', 'revoked']);
  pgm.createType('gym_scan_type', ['entry', 'early_exit', 'exit']);
  pgm.createType('gym_scan_outcome', [
    'started',
    'too_early',
    'verified',
    'rejected',
  ]);
  pgm.createType('region_waitlist_status', [
    'waiting',
    'contacted',
    'launched',
    'closed',
  ]);

  pgm.addColumn('users', {
    pilot_onboarding_reset_at: { type: 'timestamp with time zone' },
  });
  pgm.addColumns('legal_documents', {
    owner_approved_at: { type: 'timestamp with time zone' },
    owner_approved_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
  });

  pgm.createTable('gym_locations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    region_policy_id: {
      type: 'uuid',
      notNull: true,
      references: 'region_policies',
      onDelete: 'RESTRICT',
    },
    name: { type: 'varchar(160)', notNull: true },
    address: { type: 'varchar(500)', notNull: true },
    coordinates: { type: 'geography(Point,4326)', notNull: true },
    radius_meters: { type: 'integer', notNull: true, default: 75 },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('gym_locations', 'gym_locations_radius_range', {
    check: 'radius_meters BETWEEN 10 AND 500',
  });
  pgm.createIndex('gym_locations', ['region_policy_id', 'active']);
  pgm.sql(
    'CREATE INDEX gym_locations_coordinates_gist ON gym_locations USING GIST (coordinates);',
  );

  pgm.createTable('gym_qr_credentials', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    gym_location_id: {
      type: 'uuid',
      notNull: true,
      references: 'gym_locations',
      onDelete: 'RESTRICT',
    },
    credential_version: { type: 'integer', notNull: true },
    token_hash: { type: 'char(64)', notNull: true, unique: true },
    status: {
      type: 'gym_qr_credential_status',
      notNull: true,
      default: 'active',
    },
    issued_by_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    issued_at: timestamp,
    revoked_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    revoked_at: { type: 'timestamp with time zone' },
    revocation_reason: { type: 'text' },
  });
  pgm.addConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_gym_version_unique',
    { unique: ['gym_location_id', 'credential_version'] },
  );
  pgm.addConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_version_positive',
    { check: 'credential_version > 0' },
  );
  pgm.addConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_revocation_complete',
    {
      check:
        "status = 'active' OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND length(trim(revocation_reason)) >= 8)",
    },
  );
  pgm.sql(`
    CREATE UNIQUE INDEX gym_qr_credentials_one_active_per_gym
      ON gym_qr_credentials (gym_location_id)
      WHERE status = 'active';
  `);

  pgm.createTable('competition_gym_locations', {
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'CASCADE',
    },
    gym_location_id: {
      type: 'uuid',
      notNull: true,
      references: 'gym_locations',
      onDelete: 'RESTRICT',
    },
    created_at: timestamp,
  });
  pgm.addConstraint(
    'competition_gym_locations',
    'competition_gym_locations_pk',
    { primaryKey: ['competition_id', 'gym_location_id'] },
  );

  pgm.addColumns('workout_sessions', {
    gym_location_id: {
      type: 'uuid',
      references: 'gym_locations',
      onDelete: 'RESTRICT',
    },
    gym_credential_version: { type: 'integer' },
    expires_at: { type: 'timestamp with time zone' },
    verification_mode: {
      type: 'varchar(32)',
      notNull: true,
      default: 'legacy_evidence',
    },
  });
  pgm.addConstraint('workout_sessions', 'workout_sessions_qr_fields_complete', {
    check: `
        verification_mode <> 'static_qr'
        OR (gym_location_id IS NOT NULL AND gym_credential_version IS NOT NULL AND expires_at IS NOT NULL)
      `,
  });

  pgm.createTable('gym_scan_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    session_id: {
      type: 'uuid',
      notNull: true,
      references: 'workout_sessions',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    gym_location_id: {
      type: 'uuid',
      notNull: true,
      references: 'gym_locations',
      onDelete: 'RESTRICT',
    },
    credential_version: { type: 'integer', notNull: true },
    client_event_hash: { type: 'char(64)', notNull: true },
    scan_type: { type: 'gym_scan_type', notNull: true },
    outcome: { type: 'gym_scan_outcome', notNull: true },
    server_timestamp: timestamp,
  });
  pgm.addConstraint('gym_scan_events', 'gym_scan_events_client_unique', {
    unique: ['user_id', 'client_event_hash'],
  });
  pgm.createIndex('gym_scan_events', ['gym_location_id', 'server_timestamp']);
  pgm.createIndex('gym_scan_events', ['session_id', 'server_timestamp']);

  pgm.createTable('region_waitlist_entries', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL',
    },
    email: { type: 'citext', notNull: true },
    requested_region: { type: 'varchar(160)', notNull: true },
    country_code: { type: 'char(2)' },
    subdivision_code: { type: 'varchar(8)' },
    source: { type: 'varchar(64)', notNull: true },
    status: {
      type: 'region_waitlist_status',
      notNull: true,
      default: 'waiting',
    },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_email_region_unique',
    { unique: ['email', 'requested_region'] },
  );

  pgm.createTable('interest_submissions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    audience: { type: 'varchar(32)', notNull: true },
    email: { type: 'citext', notNull: true },
    full_name: { type: 'varchar(100)', notNull: true },
    company_name: { type: 'varchar(140)' },
    website: { type: 'varchar(300)' },
    region: { type: 'varchar(160)', notNull: true },
    goal_days: { type: 'smallint' },
    workout_style: { type: 'varchar(60)' },
    partnership_interest: { type: 'varchar(80)' },
    discovery_source: { type: 'varchar(80)' },
    message: { type: 'text' },
    consent: { type: 'boolean', notNull: true },
    source: { type: 'varchar(64)', notNull: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('interest_submissions', 'interest_submissions_unique', {
    unique: ['audience', 'email'],
  });
  pgm.addConstraint('interest_submissions', 'interest_submissions_audience', {
    check: "audience IN ('gym_goer', 'brand')",
  });

  pgm.createTable('cash_fulfillments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    reward_award_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'reward_awards',
      onDelete: 'RESTRICT',
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    winner_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    amount_cents: { type: 'integer', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    fulfilled_by_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    fulfilled_at: { type: 'timestamp with time zone', notNull: true },
    fulfillment_note: { type: 'text', notNull: true },
    created_at: timestamp,
  });
  pgm.addConstraint('cash_fulfillments', 'cash_fulfillments_amount', {
    check: 'amount_cents > 0',
  });

  pgm.dropConstraint('competitions', 'competitions_entrant_limits');
  pgm.addConstraint('competitions', 'competitions_entrant_limits', {
    check:
      'minimum_entrants >= 2 AND (entrant_cap IS NULL OR entrant_cap >= minimum_entrants)',
  });
  pgm.sql("ALTER TYPE reward_type ADD VALUE IF NOT EXISTS 'cash';");
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('competitions', 'competitions_entrant_limits');
  pgm.addConstraint('competitions', 'competitions_entrant_limits', {
    check:
      'minimum_entrants >= 100 AND (entrant_cap IS NULL OR entrant_cap >= minimum_entrants)',
  });
  pgm.dropTable('cash_fulfillments');
  pgm.dropTable('interest_submissions');
  pgm.dropTable('region_waitlist_entries');
  pgm.dropTable('gym_scan_events');
  pgm.dropConstraint('workout_sessions', 'workout_sessions_qr_fields_complete');
  pgm.dropColumns('workout_sessions', [
    'gym_location_id',
    'gym_credential_version',
    'expires_at',
    'verification_mode',
  ]);
  pgm.dropTable('competition_gym_locations');
  pgm.dropTable('gym_qr_credentials');
  pgm.dropTable('gym_locations');
  pgm.dropColumns('legal_documents', [
    'owner_approved_at',
    'owner_approved_by_user_id',
  ]);
  pgm.dropColumn('users', 'pilot_onboarding_reset_at');
  pgm.dropType('region_waitlist_status');
  pgm.dropType('gym_scan_outcome');
  pgm.dropType('gym_scan_type');
  pgm.dropType('gym_qr_credential_status');
  // PostgreSQL enum values are intentionally not removed on rollback.
}
