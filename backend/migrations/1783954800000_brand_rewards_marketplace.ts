import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS competition_draws_reject_non_cash_demo ON competition_draws;
    DROP TRIGGER IF EXISTS competition_progress_reject_non_cash_demo ON competition_progress;
    DROP TRIGGER IF EXISTS entry_ledger_reject_non_cash_demo ON entry_ledger;
    DROP FUNCTION IF EXISTS gogymgo_reject_demo_financial_state();
    ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_demo_never_settles;
    ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_demo_rules_zero_value;

    UPDATE competitions
    SET rules = (rules - 'payoutPoolAmountMinor' - 'payoutWinnerCount' - 'payoutExponent')
      || jsonb_build_object(
        'signupPrizeDrawEntries', GREATEST(COALESCE((rules->>'signupPrizeDrawEntries')::integer, 0), 1),
        'verifiedSessionCategoryScore', GREATEST(COALESCE((rules->>'verifiedSessionCategoryScore')::integer, 0), 1),
        'verifiedSessionPrizeDrawEntries', GREATEST(COALESCE((rules->>'verifiedSessionPrizeDrawEntries')::integer, 0), 1)
      );

    DROP TRIGGER IF EXISTS payout_release_control_delete_guard ON payout_release_control;
    DROP TRIGGER IF EXISTS payout_release_control_guard ON payout_release_control;
    DROP FUNCTION IF EXISTS gogymgo_reject_payout_release_control_delete();
    DROP FUNCTION IF EXISTS gogymgo_enforce_payout_release_control_update();
    DROP TRIGGER IF EXISTS hyperwallet_users_provider_identity ON hyperwallet_users;
    DROP FUNCTION IF EXISTS gogymgo_enforce_hyperwallet_user_identity();
    DROP TRIGGER IF EXISTS payout_payments_financial_identity ON payout_payments;
    DROP FUNCTION IF EXISTS gogymgo_enforce_payout_payment_identity();
    DROP TRIGGER IF EXISTS payout_claims_financial_integrity ON payout_claims;
    DROP FUNCTION IF EXISTS gogymgo_enforce_payout_claim_integrity();
    DROP TRIGGER IF EXISTS payout_state_events_append_only ON payout_state_events;
    DROP TRIGGER IF EXISTS draw_winners_append_only ON draw_winners;

    DROP TABLE IF EXISTS payout_release_control;
    DROP TABLE IF EXISTS payout_state_events;
    DROP TABLE IF EXISTS payout_payments;
    DROP TABLE IF EXISTS provider_webhooks;
    DROP TABLE IF EXISTS hyperwallet_users;
    DROP TABLE IF EXISTS payout_claims;
    DROP TABLE IF EXISTS draw_winners;
    DROP TYPE IF EXISTS provider_webhook_state;
    DROP TYPE IF EXISTS payout_claim_status;

    ALTER TABLE competitions DROP COLUMN IF EXISTS currency;
    ALTER TABLE competitions DROP COLUMN IF EXISTS mode;
    DROP TYPE IF EXISTS competition_mode;
    ALTER TABLE region_policies DROP COLUMN IF EXISTS payout_enabled;
  `);

  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createType('reward_type', ['physical', 'coupon']);
  pgm.createType('reward_catalog_status', ['draft', 'published', 'archived']);
  pgm.createType('reward_award_status', [
    'awarded',
    'claimed',
    'fulfilled',
    'redeemed',
    'cancelled',
  ]);

  pgm.createTable('reward_catalog_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    sponsor_name: { type: 'varchar(120)', notNull: true },
    title: { type: 'varchar(160)', notNull: true },
    description: { type: 'text', notNull: true },
    reward_type: { type: 'reward_type', notNull: true },
    status: {
      type: 'reward_catalog_status',
      notNull: true,
      default: 'draft',
    },
    image_url: { type: 'varchar(2048)' },
    terms_url: { type: 'varchar(2048)' },
    claim_url: { type: 'varchar(2048)' },
    fulfillment_instructions: { type: 'text' },
    inventory_total: { type: 'integer', notNull: true },
    display_order: { type: 'integer', notNull: true, default: 0 },
    available_from: { type: 'timestamp with time zone' },
    available_until: { type: 'timestamp with time zone' },
    version: { type: 'integer', notNull: true, default: 1 },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_inventory_valid', {
    check: 'inventory_total > 0 AND display_order >= 0 AND version > 0',
  });
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_window_valid', {
    check:
      'available_from IS NULL OR available_until IS NULL OR available_from < available_until',
  });
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_claim_path', {
    check:
      "reward_type = 'coupon' OR claim_url IS NOT NULL OR fulfillment_instructions IS NOT NULL",
  });
  pgm.createIndex('reward_catalog_items', [
    'competition_id',
    'status',
    'display_order',
  ]);

  pgm.createTable('reward_awards', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    draw_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_draws',
      onDelete: 'RESTRICT',
    },
    reward_catalog_item_id: {
      type: 'uuid',
      notNull: true,
      references: 'reward_catalog_items',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    award_rank: { type: 'integer', notNull: true },
    status: {
      type: 'reward_award_status',
      notNull: true,
      default: 'awarded',
    },
    awarded_at: timestamp,
    claimed_at: { type: 'timestamp with time zone' },
    fulfilled_at: { type: 'timestamp with time zone' },
    redeemed_at: { type: 'timestamp with time zone' },
    updated_at: timestamp,
  });
  pgm.addConstraint('reward_awards', 'reward_awards_user_unique', {
    unique: ['draw_id', 'user_id'],
  });
  pgm.addConstraint('reward_awards', 'reward_awards_rank_unique', {
    unique: ['draw_id', 'award_rank'],
  });
  pgm.addConstraint('reward_awards', 'reward_awards_rank_positive', {
    check: 'award_rank > 0',
  });
  pgm.addConstraint('reward_awards', 'reward_awards_status_timestamps', {
    check: `
      (status IN ('awarded', 'cancelled') OR claimed_at IS NOT NULL)
      AND (status <> 'fulfilled' OR fulfilled_at IS NOT NULL)
      AND (status <> 'redeemed' OR redeemed_at IS NOT NULL)
    `,
  });
  pgm.createIndex('reward_awards', ['user_id', 'status', 'awarded_at']);

  pgm.createTable('reward_coupon_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    reward_catalog_item_id: {
      type: 'uuid',
      notNull: true,
      references: 'reward_catalog_items',
      onDelete: 'RESTRICT',
    },
    encrypted_code: { type: 'text', notNull: true },
    code_fingerprint: { type: 'char(64)', notNull: true, unique: true },
    assigned_award_id: {
      type: 'uuid',
      unique: true,
      references: 'reward_awards',
      onDelete: 'RESTRICT',
    },
    created_at: timestamp,
    assigned_at: { type: 'timestamp with time zone' },
    redeemed_at: { type: 'timestamp with time zone' },
  });
  pgm.createIndex('reward_coupon_codes', [
    'reward_catalog_item_id',
    'assigned_award_id',
  ]);

  pgm.sql(`
    CREATE FUNCTION gogymgo_enforce_reward_inventory()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      available_inventory integer;
      assigned_inventory integer;
    BEGIN
      SELECT inventory_total INTO available_inventory
      FROM reward_catalog_items
      WHERE id = NEW.reward_catalog_item_id
      FOR UPDATE;

      SELECT COUNT(*) INTO assigned_inventory
      FROM reward_awards
      WHERE reward_catalog_item_id = NEW.reward_catalog_item_id
        AND status <> 'cancelled'
        AND (TG_OP = 'INSERT' OR id <> NEW.id);

      IF NEW.status <> 'cancelled' AND assigned_inventory >= available_inventory THEN
        RAISE EXCEPTION 'reward inventory exhausted';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER reward_awards_inventory_guard
    BEFORE INSERT OR UPDATE OF reward_catalog_item_id, status ON reward_awards
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_reward_inventory();
  `);
}

export function down(): void {
  throw new Error(
    'This decommission migration is intentionally irreversible because it removes payment identity and payout records. Restore a pre-migration backup instead.',
  );
}
