import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createExtension('citext', { ifNotExists: true });
  pgm.createExtension('postgis', { ifNotExists: true });

  pgm.createType('account_status', ['active', 'suspended', 'deleted']);
  pgm.createType('public_identity_mode', ['private', 'alias', 'real_name']);
  pgm.createType('region_verification_method', [
    'device_location',
    'postal_code',
    'manual_review',
  ]);
  pgm.createType('region_verification_status', [
    'pending',
    'approved',
    'rejected',
    'expired',
  ]);
  pgm.createType('idempotency_state', ['processing', 'completed']);

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    firebase_uid: { type: 'varchar(128)', notNull: true, unique: true },
    email: { type: 'citext' },
    email_verified: { type: 'boolean', notNull: true, default: false },
    roles: {
      type: 'text[]',
      notNull: true,
      default: pgm.func("ARRAY['user']::text[]"),
    },
    status: { type: 'account_status', notNull: true, default: 'active' },
    created_at: timestamp,
    updated_at: timestamp,
  });

  pgm.createTable('profiles', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    callsign: { type: 'varchar(32)', notNull: true, unique: true },
    public_identity_mode: {
      type: 'public_identity_mode',
      notNull: true,
      default: 'private',
    },
    public_name: { type: 'varchar(80)' },
    avatar_object_key: { type: 'varchar(512)' },
    privacy_settings: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    version: { type: 'integer', notNull: true, default: 1 },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('profiles', 'profiles_public_name_required', {
    check:
      "public_identity_mode = 'private' OR (public_name IS NOT NULL AND length(trim(public_name)) > 0)",
  });

  pgm.createTable('region_policies', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    code: { type: 'varchar(64)', notNull: true, unique: true },
    country_code: { type: 'char(2)', notNull: true },
    subdivision_code: { type: 'varchar(8)', notNull: true },
    metro_name: { type: 'varchar(120)', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    timezone: { type: 'varchar(64)', notNull: true },
    language_codes: { type: 'text[]', notNull: true },
    minimum_age: { type: 'smallint', notNull: true },
    competition_enabled: { type: 'boolean', notNull: true, default: false },
    boundary_version: { type: 'varchar(64)', notNull: true },
    policy_version: { type: 'varchar(64)', notNull: true },
    boundary: { type: 'geography(MultiPolygon,4326)' },
    valid_from: { type: 'timestamp with time zone', notNull: true },
    valid_to: { type: 'timestamp with time zone' },
    created_at: timestamp,
  });
  pgm.addConstraint('region_policies', 'region_policies_minimum_age_range', {
    check: 'minimum_age BETWEEN 13 AND 99',
  });
  pgm.addConstraint('region_policies', 'region_policies_valid_window', {
    check: 'valid_to IS NULL OR valid_to > valid_from',
  });
  pgm.createIndex('region_policies', ['country_code', 'subdivision_code']);
  pgm.sql(
    'CREATE INDEX region_policies_boundary_gist ON region_policies USING GIST (boundary);',
  );

  pgm.createTable('region_verifications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    region_policy_id: {
      type: 'uuid',
      notNull: true,
      references: 'region_policies',
      onDelete: 'RESTRICT',
    },
    method: { type: 'region_verification_method', notNull: true },
    status: {
      type: 'region_verification_status',
      notNull: true,
      default: 'pending',
    },
    evidence_metadata: { type: 'jsonb', notNull: true },
    policy_version: { type: 'varchar(64)', notNull: true },
    reviewed_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    decision_reason: { type: 'text' },
    verified_at: { type: 'timestamp with time zone' },
    expires_at: { type: 'timestamp with time zone' },
    created_at: timestamp,
  });
  pgm.createIndex('region_verifications', ['user_id', 'created_at']);
  pgm.createIndex('region_verifications', ['status', 'created_at']);

  pgm.createTable('idempotency_keys', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    scope: { type: 'varchar(120)', notNull: true },
    actor_key: { type: 'varchar(180)', notNull: true },
    idempotency_key: { type: 'varchar(128)', notNull: true },
    request_hash: { type: 'char(64)', notNull: true },
    state: { type: 'idempotency_state', notNull: true, default: 'processing' },
    response_code: { type: 'integer' },
    response_body: { type: 'jsonb' },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    created_at: timestamp,
    completed_at: { type: 'timestamp with time zone' },
  });
  pgm.addConstraint(
    'idempotency_keys',
    'idempotency_keys_scope_actor_key_unique',
    {
      unique: ['scope', 'actor_key', 'idempotency_key'],
    },
  );
  pgm.addConstraint('idempotency_keys', 'idempotency_keys_completed_response', {
    check:
      "state = 'processing' OR (state = 'completed' AND response_code IS NOT NULL AND response_body IS NOT NULL AND completed_at IS NOT NULL)",
  });
  pgm.createIndex('idempotency_keys', 'expires_at');

  pgm.createTable('operator_audit_events', {
    id: { type: 'bigserial', primaryKey: true },
    actor_user_id: { type: 'uuid', references: 'users', onDelete: 'RESTRICT' },
    action: { type: 'varchar(120)', notNull: true },
    entity_type: { type: 'varchar(120)', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    previous_state: { type: 'jsonb' },
    next_state: { type: 'jsonb' },
    reason: { type: 'text', notNull: true },
    request_id: { type: 'varchar(128)', notNull: true },
    created_at: timestamp,
  });
  pgm.createIndex('operator_audit_events', [
    'entity_type',
    'entity_id',
    'created_at',
  ]);

  pgm.sql(`
    CREATE FUNCTION gogymgo_reject_append_only_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
    END;
    $$;

    CREATE TRIGGER operator_audit_events_append_only
    BEFORE UPDATE OR DELETE ON operator_audit_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS operator_audit_events_append_only ON operator_audit_events;',
  );
  pgm.dropTable('operator_audit_events');
  pgm.dropTable('idempotency_keys');
  pgm.dropTable('region_verifications');
  pgm.dropTable('region_policies');
  pgm.dropTable('profiles');
  pgm.dropTable('users');
  pgm.dropFunction('gogymgo_reject_append_only_mutation', []);
  pgm.dropType('idempotency_state');
  pgm.dropType('region_verification_status');
  pgm.dropType('region_verification_method');
  pgm.dropType('public_identity_mode');
  pgm.dropType('account_status');
}
