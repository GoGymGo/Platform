import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
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

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS reward_awards_inventory_guard ON reward_awards;
    DROP FUNCTION IF EXISTS gogymgo_enforce_reward_inventory();
  `);
  pgm.dropTable('reward_coupon_codes');
  pgm.dropTable('reward_awards');
  pgm.dropTable('reward_catalog_items');
  pgm.dropType('reward_award_status');
  pgm.dropType('reward_catalog_status');
  pgm.dropType('reward_type');
}
