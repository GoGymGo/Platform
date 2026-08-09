import type { MigrationBuilder } from 'node-pg-migrate';

const deletableTables = [
  'competitions',
  'reward_catalog_items',
  'creator_workouts',
  'gym_locations',
  'region_policies',
  'legal_documents',
] as const;

export function up(pgm: MigrationBuilder): void {
  for (const table of deletableTables) {
    pgm.addColumn(table, {
      deleted_at: { type: 'timestamp with time zone' },
    });
    pgm.createIndex(table, ['deleted_at']);
  }
}

export function down(pgm: MigrationBuilder): void {
  for (const table of [...deletableTables].reverse()) {
    pgm.dropColumn(table, 'deleted_at');
  }
}
