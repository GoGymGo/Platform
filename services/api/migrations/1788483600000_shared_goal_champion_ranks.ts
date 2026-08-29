import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.dropConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_category_rank_unique',
  );
  pgm.createIndex(
    'competition_settlement_inputs',
    ['draw_id', 'goal_days', 'category_rank'],
    { name: 'competition_settlement_inputs_category_rank_idx' },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM competition_settlement_inputs
        GROUP BY draw_id, goal_days, category_rank
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Shared Goal Champion ranks must be preserved; use a forward migration.';
      END IF;
    END;
    $$;
  `);
  pgm.dropIndex(
    'competition_settlement_inputs',
    ['draw_id', 'goal_days', 'category_rank'],
    { name: 'competition_settlement_inputs_category_rank_idx' },
  );
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_category_rank_unique',
    { unique: ['draw_id', 'goal_days', 'category_rank'] },
  );
}
