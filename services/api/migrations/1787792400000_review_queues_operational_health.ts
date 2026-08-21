import type { MigrationBuilder } from 'node-pg-migrate';

const reviewTables = [
  'workout_sessions',
  'region_verifications',
  'partner_applications',
  'profile_media',
  'creator_video_submissions',
  'region_waitlist_entries',
] as const;

export function up(pgm: MigrationBuilder): void {
  for (const table of reviewTables) {
    pgm.addColumn(table, {
      review_version: {
        type: 'integer',
        notNull: true,
        default: 1,
      },
    });
    pgm.addConstraint(table, `${table}_review_version_positive`, {
      check: 'review_version > 0',
    });
  }

  pgm.addColumns('profile_media', {
    cleanup_attempt_count: { type: 'integer', notNull: true, default: 0 },
    cleanup_failure_code: { type: 'varchar(120)' },
    cleanup_lease_expires_at: { type: 'timestamp with time zone' },
    cleanup_lease_token: { type: 'uuid' },
    cleanup_next_attempt_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint('profile_media', 'profile_media_cleanup_attempt_valid', {
    check: 'cleanup_attempt_count >= 0',
  });
  pgm.addConstraint('profile_media', 'profile_media_cleanup_lease_pair', {
    check: '(cleanup_lease_token IS NULL) = (cleanup_lease_expires_at IS NULL)',
  });

  pgm.createIndex(
    'profile_media',
    ['cleanup_next_attempt_at', 'cleanup_lease_expires_at', 'created_at'],
    {
      name: 'profile_media_cleanup_claimable_idx',
      where:
        "object_deleted_at IS NULL AND status IN ('pending_upload', 'rejected', 'removed', 'superseded')",
    },
  );
  pgm.createIndex('operator_audit_events', ['created_at', 'id'], {
    name: 'operator_audit_events_page_idx',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('operator_audit_events', ['created_at', 'id'], {
    ifExists: true,
    name: 'operator_audit_events_page_idx',
  });
  pgm.dropIndex(
    'profile_media',
    ['cleanup_next_attempt_at', 'cleanup_lease_expires_at', 'created_at'],
    { ifExists: true, name: 'profile_media_cleanup_claimable_idx' },
  );
  pgm.dropConstraint('profile_media', 'profile_media_cleanup_lease_pair', {
    ifExists: true,
  });
  pgm.dropConstraint('profile_media', 'profile_media_cleanup_attempt_valid', {
    ifExists: true,
  });
  pgm.dropColumns(
    'profile_media',
    [
      'cleanup_attempt_count',
      'cleanup_failure_code',
      'cleanup_lease_expires_at',
      'cleanup_lease_token',
      'cleanup_next_attempt_at',
    ],
    { ifExists: true },
  );
  for (const table of [...reviewTables].reverse()) {
    pgm.dropConstraint(table, `${table}_review_version_positive`, {
      ifExists: true,
    });
    pgm.dropColumn(table, 'review_version', { ifExists: true });
  }
}
