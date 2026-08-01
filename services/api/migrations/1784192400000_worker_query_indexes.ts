import type { MigrationBuilder } from 'node-pg-migrate';

const profileCleanupIndex = 'profile_media_cleanup_queue_idx';
const unresolvedSessionsIndex =
  'workout_sessions_competition_date_unresolved_idx';
const verifiedSessionsIndex = 'workout_sessions_competition_date_verified_idx';

export function up(pgm: MigrationBuilder): void {
  pgm.createIndex('profile_media', ['expires_at', 'created_at'], {
    name: profileCleanupIndex,
    where:
      "object_deleted_at IS NULL AND status IN ('pending_upload', 'rejected', 'removed', 'superseded')",
  });
  pgm.createIndex('workout_sessions', ['competition_id', 'eligible_date'], {
    name: unresolvedSessionsIndex,
    where: "status IN ('active', 'pending_review')",
  });
  pgm.createIndex(
    'workout_sessions',
    ['competition_id', 'eligible_date', 'user_id'],
    {
      name: verifiedSessionsIndex,
      where: "status = 'verified'",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'workout_sessions',
    ['competition_id', 'eligible_date', 'user_id'],
    {
      ifExists: true,
      name: verifiedSessionsIndex,
    },
  );
  pgm.dropIndex('workout_sessions', ['competition_id', 'eligible_date'], {
    ifExists: true,
    name: unresolvedSessionsIndex,
  });
  pgm.dropIndex('profile_media', ['expires_at', 'created_at'], {
    ifExists: true,
    name: profileCleanupIndex,
  });
}
