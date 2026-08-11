import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.alterColumn('competitions', 'minimum_entrants', { default: 1 });
  pgm.sql(`
    UPDATE competitions
    SET minimum_entrants = 1,
        configuration_version = configuration_version + 1,
        updated_at = NOW()
    WHERE status IN ('draft', 'registration')
      AND minimum_entrants <> 1
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.alterColumn('competitions', 'minimum_entrants', { default: 100 });
}
