import type { MigrationBuilder } from 'node-pg-migrate';

const profileSearchIndex = 'profiles_screen_name_trgm_idx';

export function up(pgm: MigrationBuilder): void {
  pgm.createExtension('pg_trgm', { ifNotExists: true });
  pgm.sql(`
    CREATE INDEX ${profileSearchIndex}
      ON profiles
      USING gin ((screen_name::text) gin_trgm_ops)
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP INDEX IF EXISTS ${profileSearchIndex}`);
}
