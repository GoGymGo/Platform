import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createType('payout_claim_status', [
    'pending_review',
    'action_required',
    'verification_pending',
    'ready',
    'processing',
    'paid',
    'failed',
    'cancelled',
  ]);
  pgm.createType('provider_webhook_state', ['received', 'processed', 'failed']);
  pgm.createType('partner_application_type', ['creator', 'sponsor', 'gym']);
  pgm.createType('partner_application_status', [
    'submitted',
    'in_review',
    'approved',
    'rejected',
  ]);
  pgm.createType('notification_delivery_status', [
    'pending',
    'sent',
    'failed',
    'cancelled',
  ]);
  pgm.createType('privacy_request_type', ['export', 'delete']);
  pgm.createType('privacy_request_status', [
    'requested',
    'processing',
    'completed',
    'rejected',
  ]);

  pgm.createTable('payout_claims', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    draw_winner_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'draw_winners',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    status: {
      type: 'payout_claim_status',
      notNull: true,
      default: 'pending_review',
    },
    provider: { type: 'varchar(32)', notNull: true, default: 'hyperwallet' },
    amount_minor: { type: 'bigint', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    approved_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    approved_at: { type: 'timestamp with time zone' },
    paid_at: { type: 'timestamp with time zone' },
    failure_code: { type: 'varchar(120)' },
    version: { type: 'integer', notNull: true, default: 1 },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('payout_claims', 'payout_claims_positive_amount', {
    check: "amount_minor > 0 AND provider = 'hyperwallet'",
  });
  pgm.createIndex('payout_claims', ['user_id', 'created_at']);
  pgm.createIndex('payout_claims', ['status', 'updated_at']);

  pgm.createTable('hyperwallet_users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    program_token: { type: 'varchar(64)', notNull: true },
    provider_user_token: { type: 'varchar(64)', notNull: true, unique: true },
    provider_status: { type: 'varchar(64)', notNull: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint(
    'hyperwallet_users',
    'hyperwallet_users_program_user_unique',
    {
      unique: ['program_token', 'user_id'],
    },
  );

  pgm.createTable('payout_payments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    payout_claim_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'payout_claims',
      onDelete: 'RESTRICT',
    },
    client_payment_id: { type: 'varchar(50)', notNull: true, unique: true },
    provider_payment_token: { type: 'varchar(64)', unique: true },
    provider_status: { type: 'varchar(96)', notNull: true },
    amount_minor: { type: 'bigint', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('payout_payments', 'payout_payments_positive_amount', {
    check: 'amount_minor > 0',
  });

  pgm.createTable('provider_webhooks', {
    provider_webhook_token: { type: 'varchar(64)', primaryKey: true },
    provider: { type: 'varchar(32)', notNull: true, default: 'hyperwallet' },
    event_type: { type: 'varchar(160)', notNull: true },
    provider_created_on: { type: 'timestamp with time zone' },
    object_token: { type: 'varchar(64)' },
    object_status: { type: 'varchar(96)' },
    payload_hash: { type: 'char(64)' },
    normalized_payload: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    state: {
      type: 'provider_webhook_state',
      notNull: true,
      default: 'received',
    },
    attempt_count: { type: 'integer', notNull: true, default: 0 },
    processing_error: { type: 'varchar(512)' },
    received_at: timestamp,
    processed_at: { type: 'timestamp with time zone' },
  });
  pgm.addConstraint('provider_webhooks', 'provider_webhooks_provider_check', {
    check: "provider = 'hyperwallet'",
  });
  pgm.createIndex('provider_webhooks', ['state', 'received_at']);

  pgm.createTable('payout_state_events', {
    id: { type: 'bigserial', primaryKey: true },
    payout_claim_id: {
      type: 'uuid',
      notNull: true,
      references: 'payout_claims',
      onDelete: 'RESTRICT',
    },
    previous_status: { type: 'payout_claim_status' },
    next_status: { type: 'payout_claim_status', notNull: true },
    source: { type: 'varchar(120)', notNull: true },
    source_event_id: { type: 'varchar(128)', notNull: true },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: timestamp,
  });
  pgm.addConstraint(
    'payout_state_events',
    'payout_state_events_source_unique',
    {
      unique: ['payout_claim_id', 'source', 'source_event_id', 'next_status'],
    },
  );

  pgm.createTable('partner_applications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    application_type: { type: 'partner_application_type', notNull: true },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    contact_email: { type: 'citext' },
    region: { type: 'varchar(120)', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    dedupe_hash: { type: 'char(64)', notNull: true, unique: true },
    status: {
      type: 'partner_application_status',
      notNull: true,
      default: 'submitted',
    },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.createIndex('partner_applications', [
    'application_type',
    'status',
    'created_at',
  ]);

  pgm.createTable('push_devices', {
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
    provider: { type: 'varchar(24)', notNull: true },
    platform: { type: 'varchar(24)', notNull: true },
    push_token: { type: 'varchar(512)', notNull: true, unique: true },
    enabled: { type: 'boolean', notNull: true, default: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('push_devices', 'push_devices_provider_platform_check', {
    check: "provider = 'expo' AND platform IN ('ios', 'android')",
  });
  pgm.createIndex('push_devices', ['user_id', 'enabled']);

  pgm.createTable('notification_deliveries', {
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
    template: { type: 'varchar(120)', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    status: {
      type: 'notification_delivery_status',
      notNull: true,
      default: 'pending',
    },
    attempt_count: { type: 'integer', notNull: true, default: 0 },
    last_error: { type: 'varchar(512)' },
    scheduled_at: { type: 'timestamp with time zone', notNull: true },
    sent_at: { type: 'timestamp with time zone' },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.createIndex('notification_deliveries', ['status', 'scheduled_at']);

  pgm.createTable('privacy_requests', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    request_type: { type: 'privacy_request_type', notNull: true },
    status: {
      type: 'privacy_request_status',
      notNull: true,
      default: 'requested',
    },
    reason: { type: 'text' },
    result_object_key: { type: 'varchar(512)' },
    requested_at: timestamp,
    completed_at: { type: 'timestamp with time zone' },
  });
  pgm.createIndex('privacy_requests', ['user_id', 'requested_at']);
  pgm.createIndex('privacy_requests', ['status', 'requested_at']);

  pgm.createTable('creator_workouts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    creator_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    title: { type: 'varchar(160)', notNull: true },
    creator_name: { type: 'varchar(120)', notNull: true },
    video_url: { type: 'varchar(2048)', notNull: true },
    thumbnail_url: { type: 'varchar(2048)' },
    duration_minutes: { type: 'integer', notNull: true },
    workout_style: { type: 'varchar(120)', notNull: true },
    sponsor_name: { type: 'varchar(120)' },
    region_codes: { type: 'text[]', notNull: true },
    published: { type: 'boolean', notNull: true, default: false },
    published_at: { type: 'timestamp with time zone' },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('creator_workouts', 'creator_workouts_duration_check', {
    check: 'duration_minutes BETWEEN 1 AND 240',
  });
  pgm.createIndex('creator_workouts', ['published', 'published_at']);

  pgm.sql(`
    CREATE TRIGGER payout_state_events_append_only
    BEFORE UPDATE OR DELETE ON payout_state_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS payout_state_events_append_only ON payout_state_events;',
  );
  pgm.dropTable('creator_workouts');
  pgm.dropTable('privacy_requests');
  pgm.dropTable('notification_deliveries');
  pgm.dropTable('push_devices');
  pgm.dropTable('partner_applications');
  pgm.dropTable('payout_state_events');
  pgm.dropTable('provider_webhooks');
  pgm.dropTable('payout_payments');
  pgm.dropTable('hyperwallet_users');
  pgm.dropTable('payout_claims');
  pgm.dropType('privacy_request_status');
  pgm.dropType('privacy_request_type');
  pgm.dropType('notification_delivery_status');
  pgm.dropType('partner_application_status');
  pgm.dropType('partner_application_type');
  pgm.dropType('provider_webhook_state');
  pgm.dropType('payout_claim_status');
}
