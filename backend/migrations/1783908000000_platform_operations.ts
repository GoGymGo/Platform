import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

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
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('creator_workouts');
  pgm.dropTable('privacy_requests');
  pgm.dropTable('notification_deliveries');
  pgm.dropTable('push_devices');
  pgm.dropTable('partner_applications');
  pgm.dropType('privacy_request_status');
  pgm.dropType('privacy_request_type');
  pgm.dropType('notification_delivery_status');
  pgm.dropType('partner_application_status');
  pgm.dropType('partner_application_type');
}
