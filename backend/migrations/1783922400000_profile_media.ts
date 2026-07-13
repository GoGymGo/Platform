import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createType('profile_media_status', [
    'pending_upload',
    'pending_review',
    'approved',
    'rejected',
    'superseded',
    'removed',
    'expired',
  ]);

  pgm.createTable('profile_media', {
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
    request_key: { type: 'varchar(128)', notNull: true },
    object_key: { type: 'varchar(512)', notNull: true, unique: true },
    content_type: { type: 'varchar(64)', notNull: true },
    expected_size_bytes: { type: 'integer', notNull: true },
    actual_size_bytes: { type: 'integer' },
    storage_generation: { type: 'varchar(128)' },
    status: {
      type: 'profile_media_status',
      notNull: true,
      default: 'pending_upload',
    },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    completed_at: { type: 'timestamp with time zone' },
    reviewed_at: { type: 'timestamp with time zone' },
    reviewed_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    decision_reason: { type: 'text' },
    object_deleted_at: { type: 'timestamp with time zone' },
    created_at: timestamp,
    updated_at: timestamp,
  });

  pgm.addConstraint('profile_media', 'profile_media_user_request_key_unique', {
    unique: ['user_id', 'request_key'],
  });
  pgm.addConstraint('profile_media', 'profile_media_request_key_valid', {
    check: 'length(trim(request_key)) > 0',
  });
  pgm.addConstraint('profile_media', 'profile_media_object_key_valid', {
    check: "object_key LIKE 'avatars/%' AND position('..' in object_key) = 0",
  });
  pgm.addConstraint('profile_media', 'profile_media_content_type_valid', {
    check: "content_type IN ('image/jpeg', 'image/png', 'image/webp')",
  });
  pgm.addConstraint('profile_media', 'profile_media_expected_size_valid', {
    check: 'expected_size_bytes BETWEEN 12 AND 5242880',
  });
  pgm.addConstraint('profile_media', 'profile_media_actual_size_valid', {
    check:
      'actual_size_bytes IS NULL OR actual_size_bytes BETWEEN 12 AND 5242880',
  });
  pgm.addConstraint('profile_media', 'profile_media_completion_consistent', {
    check:
      "status NOT IN ('pending_review', 'approved', 'rejected', 'superseded') OR (completed_at IS NOT NULL AND actual_size_bytes IS NOT NULL AND storage_generation IS NOT NULL)",
  });
  pgm.addConstraint('profile_media', 'profile_media_review_consistent', {
    check:
      "status NOT IN ('approved', 'rejected') OR (reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND decision_reason IS NOT NULL)",
  });
  pgm.addConstraint('profile_media', 'profile_media_expiry_valid', {
    check: 'expires_at > created_at',
  });
  pgm.createIndex('profile_media', ['user_id', 'created_at']);
  pgm.createIndex('profile_media', ['status', 'created_at']);
  pgm.createIndex('profile_media', ['user_id'], {
    name: 'profile_media_one_approved_per_user',
    unique: true,
    where: "status = 'approved'",
  });
  pgm.createIndex('profile_media', ['expires_at'], {
    name: 'profile_media_pending_expiry_idx',
    where: "status = 'pending_upload' AND object_deleted_at IS NULL",
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('profile_media');
  pgm.dropType('profile_media_status');
}
