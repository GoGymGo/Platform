import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.noTransaction();
  pgm.createIndex(
    'workout_sessions',
    ['user_id', { name: 'eligible_date', sort: 'DESC' }],
    {
      concurrently: true,
      name: 'workout_sessions_user_verified_eligible_date_idx',
      where: "status = 'verified'",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.noTransaction();
  pgm.dropIndex(
    'workout_sessions',
    ['user_id', { name: 'eligible_date', sort: 'DESC' }],
    {
      concurrently: true,
      ifExists: true,
      name: 'workout_sessions_user_verified_eligible_date_idx',
    },
  );
}
