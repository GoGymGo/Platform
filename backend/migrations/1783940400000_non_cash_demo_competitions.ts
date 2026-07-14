import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createType('competition_mode', ['cash', 'non_cash_demo']);
  pgm.addColumns('competitions', {
    mode: {
      type: 'competition_mode',
      notNull: true,
      default: 'cash',
    },
  });
  pgm.addConstraint('competitions', 'competitions_demo_rules_zero_value', {
    check: `
      mode <> 'non_cash_demo'
      OR (
        rules ? 'signupPrizeDrawEntries'
        AND rules ? 'verifiedSessionCategoryScore'
        AND rules ? 'verifiedSessionPrizeDrawEntries'
        AND rules ? 'payoutPoolAmountMinor'
        AND rules ? 'payoutWinnerCount'
        AND rules ? 'payoutExponent'
        AND (rules->>'signupPrizeDrawEntries')::integer = 0
        AND (rules->>'verifiedSessionCategoryScore')::integer = 0
        AND (rules->>'verifiedSessionPrizeDrawEntries')::integer = 0
        AND (rules->>'payoutPoolAmountMinor')::integer = 0
        AND (rules->>'payoutWinnerCount')::integer = 0
        AND (rules->>'payoutExponent')::numeric = 0
      )
    `,
  });
  pgm.addConstraint('competitions', 'competitions_demo_never_settles', {
    check: "mode <> 'non_cash_demo' OR status NOT IN ('settling', 'settled')",
  });

  pgm.sql(`
    CREATE FUNCTION gogymgo_reject_demo_financial_state()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM competitions
        WHERE id = NEW.competition_id
          AND mode = 'non_cash_demo'
      ) THEN
        RAISE EXCEPTION 'non-cash demo competitions cannot create financial or entry state';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER entry_ledger_reject_non_cash_demo
    BEFORE INSERT OR UPDATE ON entry_ledger
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_demo_financial_state();

    CREATE TRIGGER competition_progress_reject_non_cash_demo
    BEFORE INSERT OR UPDATE ON competition_progress
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_demo_financial_state();

    CREATE TRIGGER competition_draws_reject_non_cash_demo
    BEFORE INSERT OR UPDATE ON competition_draws
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_demo_financial_state();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS competition_draws_reject_non_cash_demo
      ON competition_draws;
    DROP TRIGGER IF EXISTS competition_progress_reject_non_cash_demo
      ON competition_progress;
    DROP TRIGGER IF EXISTS entry_ledger_reject_non_cash_demo
      ON entry_ledger;
    DROP FUNCTION IF EXISTS gogymgo_reject_demo_financial_state();
  `);
  pgm.dropConstraint('competitions', 'competitions_demo_never_settles');
  pgm.dropConstraint('competitions', 'competitions_demo_rules_zero_value');
  pgm.dropColumns('competitions', ['mode']);
  pgm.dropType('competition_mode');
}
