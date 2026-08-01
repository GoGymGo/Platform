import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TYPE ledger_reason ADD VALUE IF NOT EXISTS 'bonus_day';
    ALTER TYPE ledger_reason ADD VALUE IF NOT EXISTS 'category_placement';
  `);
  pgm.sql(`
    UPDATE competitions
    SET rules = rules || jsonb_build_object(
      'categoryPodiumMultipliers', jsonb_build_object('1', 3, '2', 2, '3', 1.5),
      'perfectMonthMultiplier', 10,
      'weeklyChallengeBothHitMultiplier', 2,
      'weeklyChallengeRecoveryMultiplier', 3
    )
    WHERE NOT (
      rules ? 'categoryPodiumMultipliers'
      AND rules ? 'perfectMonthMultiplier'
      AND rules ? 'weeklyChallengeBothHitMultiplier'
      AND rules ? 'weeklyChallengeRecoveryMultiplier'
    );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE competitions
    SET rules = rules
      - 'categoryPodiumMultipliers'
      - 'perfectMonthMultiplier'
      - 'weeklyChallengeBothHitMultiplier'
      - 'weeklyChallengeRecoveryMultiplier';
  `);
  // PostgreSQL enum values remain reserved during forward-only rollback.
}
