import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TYPE session_event_type
      ADD VALUE IF NOT EXISTS 'presence_check';
  `);
  pgm.sql(`
    UPDATE competitions
    SET rules =
      (rules - 'requireFaceCheck')
      || jsonb_build_object(
        'requirePresenceCheck',
        COALESCE(rules->'requireFaceCheck', 'false'::jsonb)
      )
    WHERE rules ? 'requireFaceCheck'
       OR NOT rules ? 'requirePresenceCheck';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE competitions
    SET rules =
      (rules - 'requirePresenceCheck')
      || jsonb_build_object(
        'requireFaceCheck',
        COALESCE(rules->'requirePresenceCheck', 'false'::jsonb)
      )
    WHERE rules ? 'requirePresenceCheck';
  `);
  // PostgreSQL enum values remain reserved during forward-only rollback.
}
