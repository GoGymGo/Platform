import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.dropConstraint('competitions', 'competitions_entrant_limits');
  pgm.addConstraint('competitions', 'competitions_entrant_limits', {
    check:
      'minimum_entrants >= 1 AND (entrant_cap IS NULL OR entrant_cap >= minimum_entrants)',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('competitions', 'competitions_entrant_limits');
  pgm.addConstraint('competitions', 'competitions_entrant_limits', {
    check:
      'minimum_entrants >= 2 AND (entrant_cap IS NULL OR entrant_cap >= minimum_entrants)',
  });
}
