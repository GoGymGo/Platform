import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('competition_draws', {
    public_result_snapshot_hash: { type: 'varchar(64)' },
    reward_slot_count: { type: 'integer' },
    reward_snapshot_hash: { type: 'varchar(64)' },
    snapshot_finalized_at: { type: 'timestamp with time zone' },
  });
  pgm.sql(`
    UPDATE competition_draws AS draw
    SET public_result_snapshot_hash = draw.scoring_snapshot_hash,
        reward_slot_count = (
          SELECT count(*)::integer
          FROM reward_awards AS award
          WHERE award.draw_id = draw.id
        ),
        reward_snapshot_hash = draw.entrant_snapshot_hash,
        snapshot_finalized_at = draw.locked_at
  `);
  for (const column of [
    'public_result_snapshot_hash',
    'reward_slot_count',
    'reward_snapshot_hash',
  ]) {
    pgm.alterColumn('competition_draws', column, { notNull: true });
  }
  pgm.addConstraint('competition_draws', 'competition_draws_hash_formats', {
    check: `
      seed_commitment ~ '^[0-9a-f]{64}$'
      AND entrant_snapshot_hash ~ '^[0-9a-f]{64}$'
      AND scoring_snapshot_hash ~ '^[0-9a-f]{64}$'
      AND reward_snapshot_hash ~ '^[0-9a-f]{64}$'
      AND public_result_snapshot_hash ~ '^[0-9a-f]{64}$'
      AND (seed_reveal IS NULL OR seed_reveal ~ '^[0-9a-f]{64}$')
    `,
  });
  pgm.addConstraint('competition_draws', 'competition_draws_counts_valid', {
    check:
      'entrant_count > 0 AND total_entries > 0 AND reward_slot_count >= 0 AND reward_slot_count <= entrant_count',
  });

  pgm.createTable('draw_reward_catalog_snapshots', {
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
    catalog_version: { type: 'integer', notNull: true },
    sponsor_name: { type: 'varchar(120)', notNull: true },
    title: { type: 'varchar(160)', notNull: true },
    reward_type: { type: 'reward_type', notNull: true },
    inventory_total: { type: 'integer', notNull: true },
    display_order: { type: 'integer', notNull: true },
    available_from: { type: 'timestamp with time zone' },
    available_until: { type: 'timestamp with time zone' },
    available_slot_count: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'draw_reward_catalog_snapshots',
    'draw_reward_catalog_snapshots_pk',
    { primaryKey: ['draw_id', 'reward_catalog_item_id'] },
  );
  pgm.addConstraint(
    'draw_reward_catalog_snapshots',
    'draw_reward_catalog_snapshot_values',
    {
      check:
        'catalog_version > 0 AND inventory_total > 0 AND display_order >= 0 AND available_slot_count > 0 AND available_slot_count <= inventory_total',
    },
  );

  pgm.createTable('draw_reward_slots', {
    draw_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_draws',
      onDelete: 'RESTRICT',
    },
    slot_position: { type: 'integer', notNull: true },
    reward_catalog_item_id: { type: 'uuid', notNull: true },
    catalog_slot_position: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint('draw_reward_slots', 'draw_reward_slots_pk', {
    primaryKey: ['draw_id', 'slot_position'],
  });
  pgm.addConstraint('draw_reward_slots', 'draw_reward_slots_catalog_unique', {
    unique: ['draw_id', 'reward_catalog_item_id', 'catalog_slot_position'],
  });
  pgm.addConstraint('draw_reward_slots', 'draw_reward_slots_positive', {
    check: 'slot_position > 0 AND catalog_slot_position > 0',
  });
  pgm.addConstraint('draw_reward_slots', 'draw_reward_slots_catalog_fk', {
    foreignKeys: {
      columns: ['draw_id', 'reward_catalog_item_id'],
      references:
        'draw_reward_catalog_snapshots(draw_id, reward_catalog_item_id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.createTable('draw_public_identities', {
    draw_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_draws',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    alias: { type: 'varchar(120)', notNull: true },
    streak_daily: { type: 'integer', notNull: true },
    streak_weekly: { type: 'integer', notNull: true },
    streak_monthly: { type: 'integer', notNull: true },
    streak_yearly: { type: 'integer', notNull: true },
    streak_projection_version: { type: 'varchar(32)', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint('draw_public_identities', 'draw_public_identities_pk', {
    primaryKey: ['draw_id', 'user_id'],
  });
  pgm.addConstraint(
    'draw_public_identities',
    'draw_public_identities_entry_fk',
    {
      foreignKeys: {
        columns: ['draw_id', 'user_id'],
        references: 'draw_entries(draw_id, user_id)',
        onDelete: 'RESTRICT',
      },
    },
  );
  pgm.addConstraint('draw_public_identities', 'draw_public_identity_values', {
    check: `
      length(trim(alias)) BETWEEN 1 AND 120
      AND streak_daily >= 0
      AND streak_weekly >= 0
      AND streak_monthly >= 0
      AND streak_yearly >= 0
      AND streak_projection_version = 'streaks-v1'
    `,
  });

  // Preserve readable historical rows if this migration is applied to a
  // pre-release database that already contains manually settled fixtures.
  pgm.sql(`
    INSERT INTO draw_reward_catalog_snapshots
      (draw_id, reward_catalog_item_id, catalog_version, sponsor_name, title,
       reward_type, inventory_total, display_order, available_from,
       available_until, available_slot_count, created_at)
    SELECT award.draw_id, item.id, item.version, item.sponsor_name, item.title,
           item.reward_type, item.inventory_total, item.display_order,
           item.available_from, item.available_until, count(*)::integer,
           min(award.awarded_at)
    FROM reward_awards AS award
    JOIN reward_catalog_items AS item ON item.id = award.reward_catalog_item_id
    GROUP BY award.draw_id, item.id
    ON CONFLICT DO NOTHING;

    INSERT INTO draw_reward_slots
      (draw_id, slot_position, reward_catalog_item_id, catalog_slot_position,
       created_at)
    SELECT award.draw_id, award.award_rank, award.reward_catalog_item_id,
           row_number() OVER (
             PARTITION BY award.draw_id, award.reward_catalog_item_id
             ORDER BY award.award_rank
           )::integer,
           award.awarded_at
    FROM reward_awards AS award
    ON CONFLICT DO NOTHING;

    INSERT INTO draw_public_identities
      (draw_id, user_id, alias, streak_daily, streak_weekly, streak_monthly,
       streak_yearly, streak_projection_version, created_at)
    SELECT input.draw_id, input.user_id,
           CASE
             WHEN profile.public_identity_mode::text = 'private'
               THEN profile.callsign
             ELSE coalesce(profile.public_name, profile.callsign)
           END,
           0, 0, 0, 0, 'streaks-v1', input.created_at
    FROM competition_settlement_inputs AS input
    JOIN profiles AS profile ON profile.user_id = input.user_id
    ON CONFLICT DO NOTHING;
  `);

  pgm.sql(`
    CREATE FUNCTION gogymgo_enforce_draw_snapshot_insert_window()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM competition_draws
        WHERE id = NEW.draw_id
          AND snapshot_finalized_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'draw snapshots are finalized and immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'draw_snapshot_finalized';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER draw_entries_insert_window
    BEFORE INSERT ON draw_entries
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_draw_snapshot_insert_window();

    CREATE TRIGGER competition_settlement_inputs_insert_window
    BEFORE INSERT ON competition_settlement_inputs
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_draw_snapshot_insert_window();

    CREATE TRIGGER draw_reward_catalog_snapshots_insert_window
    BEFORE INSERT ON draw_reward_catalog_snapshots
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_draw_snapshot_insert_window();

    CREATE TRIGGER draw_reward_slots_insert_window
    BEFORE INSERT ON draw_reward_slots
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_draw_snapshot_insert_window();

    CREATE TRIGGER draw_public_identities_insert_window
    BEFORE INSERT ON draw_public_identities
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_draw_snapshot_insert_window();

    CREATE TRIGGER draw_reward_catalog_snapshots_append_only
    BEFORE UPDATE OR DELETE ON draw_reward_catalog_snapshots
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER draw_reward_slots_append_only
    BEFORE UPDATE OR DELETE ON draw_reward_slots
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER draw_public_identities_append_only
    BEFORE UPDATE OR DELETE ON draw_public_identities
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE FUNCTION gogymgo_enforce_competition_draw_lifecycle()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        IF NEW.status::text <> 'locked'
           OR NEW.seed_reveal IS NOT NULL
           OR NEW.settled_at IS NOT NULL
           OR NEW.snapshot_finalized_at IS NOT NULL THEN
          RAISE EXCEPTION 'draws must begin locked with an unfinished snapshot and no reveal'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_draw_initial_state';
        END IF;
        RETURN NEW;
      END IF;

      IF OLD.status::text = 'settled' THEN
        RAISE EXCEPTION 'settled draw history is immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_settled_immutable';
      END IF;
      IF NEW.competition_id IS DISTINCT FROM OLD.competition_id
         OR NEW.rules_version IS DISTINCT FROM OLD.rules_version
         OR NEW.seed_commitment IS DISTINCT FROM OLD.seed_commitment
         OR NEW.entrant_snapshot_hash IS DISTINCT FROM OLD.entrant_snapshot_hash
         OR NEW.scoring_snapshot_hash IS DISTINCT FROM OLD.scoring_snapshot_hash
         OR NEW.reward_snapshot_hash IS DISTINCT FROM OLD.reward_snapshot_hash
         OR NEW.public_result_snapshot_hash IS DISTINCT FROM OLD.public_result_snapshot_hash
         OR NEW.entrant_count IS DISTINCT FROM OLD.entrant_count
         OR NEW.total_entries IS DISTINCT FROM OLD.total_entries
         OR NEW.reward_slot_count IS DISTINCT FROM OLD.reward_slot_count
         OR NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
        RAISE EXCEPTION 'draw snapshot identity is immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_snapshot_immutable';
      END IF;
      IF OLD.snapshot_finalized_at IS NOT NULL
         AND NEW.snapshot_finalized_at IS DISTINCT FROM OLD.snapshot_finalized_at THEN
        RAISE EXCEPTION 'a finalized draw snapshot cannot be reopened'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_snapshot_immutable';
      END IF;
      IF NEW.status::text = 'locked' THEN
        IF NEW.seed_reveal IS NOT NULL OR NEW.settled_at IS NOT NULL THEN
          RAISE EXCEPTION 'a locked draw cannot contain a reveal or settlement time'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_draw_locked_state';
        END IF;
      ELSIF NEW.status::text = 'settled' THEN
        IF OLD.status::text <> 'locked'
           OR NEW.snapshot_finalized_at IS NULL
           OR NEW.seed_reveal IS NULL
           OR NEW.seed_reveal !~ '^[0-9a-f]{64}$'
           OR NEW.settled_at IS NULL THEN
          RAISE EXCEPTION 'settlement requires one finalized locked snapshot and canonical reveal'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_draw_settled_state';
        END IF;
      ELSE
        RAISE EXCEPTION 'invalid draw lifecycle transition'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_status_transition';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER competition_draw_lifecycle
    BEFORE INSERT OR UPDATE ON competition_draws
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_competition_draw_lifecycle();

    CREATE TRIGGER competition_draw_delete_guard
    BEFORE DELETE ON competition_draws
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE FUNCTION gogymgo_enforce_finalized_draw_snapshot()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      actual_entries integer;
      actual_identities integer;
      actual_reward_slots integer;
      actual_reward_snapshot_slots integer;
      actual_scoring_inputs integer;
      actual_total_entries bigint;
      competition_status text;
      lock_audits integer;
      settle_audits integer;
    BEGIN
      IF NEW.snapshot_finalized_at IS NULL THEN
        RETURN NULL;
      END IF;

      SELECT count(*)::integer, coalesce(sum(entry_count), 0)::bigint
      INTO actual_entries, actual_total_entries
      FROM draw_entries
      WHERE draw_id = NEW.id;
      SELECT count(*)::integer INTO actual_scoring_inputs
      FROM competition_settlement_inputs
      WHERE draw_id = NEW.id;
      SELECT count(*)::integer INTO actual_identities
      FROM draw_public_identities
      WHERE draw_id = NEW.id;
      SELECT count(*)::integer INTO actual_reward_slots
      FROM draw_reward_slots
      WHERE draw_id = NEW.id;
      SELECT coalesce(sum(available_slot_count), 0)::integer
      INTO actual_reward_snapshot_slots
      FROM draw_reward_catalog_snapshots
      WHERE draw_id = NEW.id;
      SELECT status::text INTO competition_status
      FROM competitions
      WHERE id = NEW.competition_id;
      SELECT count(*)::integer INTO lock_audits
      FROM operator_audit_events
      WHERE entity_type = 'competition_draws'
        AND entity_id = NEW.id
        AND action = 'draw.locked';
      SELECT count(*)::integer INTO settle_audits
      FROM operator_audit_events
      WHERE entity_type = 'competition_draws'
        AND entity_id = NEW.id
        AND action = 'draw.settled';

      IF actual_entries <> NEW.entrant_count
         OR actual_scoring_inputs <> NEW.entrant_count
         OR actual_identities <> NEW.entrant_count
         OR actual_total_entries <> NEW.total_entries
         OR actual_reward_slots <> NEW.reward_slot_count
         OR actual_reward_snapshot_slots <> NEW.reward_slot_count THEN
        RAISE EXCEPTION 'finalized draw snapshot counts do not reconcile'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_snapshot_reconciliation';
      END IF;
      IF NEW.reward_slot_count <= 0 THEN
        RAISE EXCEPTION 'finalized draw requires at least one reward slot'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_reward_snapshot_required';
      END IF;
      IF lock_audits <> 1
         OR (NEW.status::text = 'settled' AND settle_audits <> 1)
         OR (NEW.status::text = 'locked' AND settle_audits <> 0) THEN
        RAISE EXCEPTION 'draw lifecycle audit evidence is incomplete'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_audit_integrity';
      END IF;
      IF (NEW.status::text = 'locked' AND competition_status <> 'settling')
         OR (NEW.status::text = 'settled' AND competition_status <> 'settled') THEN
        RAISE EXCEPTION 'competition and draw settlement states disagree'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_draw_status_integrity';
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER competition_draw_snapshot_integrity
    AFTER INSERT OR UPDATE ON competition_draws
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_finalized_draw_snapshot();

    CREATE UNIQUE INDEX competition_draw_lifecycle_audit_unique
    ON operator_audit_events (entity_id, action)
    WHERE entity_type = 'competition_draws'
      AND action IN ('draw.locked', 'draw.settled');
  `);

  replaceRewardAwardIntegrityFunction(pgm, true);
}

export function down(pgm: MigrationBuilder): void {
  replaceRewardAwardIntegrityFunction(pgm, false);
  pgm.sql(`
    DROP INDEX IF EXISTS competition_draw_lifecycle_audit_unique;
    DROP TRIGGER IF EXISTS competition_draw_snapshot_integrity ON competition_draws;
    DROP FUNCTION IF EXISTS gogymgo_enforce_finalized_draw_snapshot();
    DROP TRIGGER IF EXISTS competition_draw_delete_guard ON competition_draws;
    DROP TRIGGER IF EXISTS competition_draw_lifecycle ON competition_draws;
    DROP FUNCTION IF EXISTS gogymgo_enforce_competition_draw_lifecycle();
    DROP TRIGGER IF EXISTS draw_public_identities_append_only ON draw_public_identities;
    DROP TRIGGER IF EXISTS draw_reward_slots_append_only ON draw_reward_slots;
    DROP TRIGGER IF EXISTS draw_reward_catalog_snapshots_append_only ON draw_reward_catalog_snapshots;
    DROP TRIGGER IF EXISTS draw_public_identities_insert_window ON draw_public_identities;
    DROP TRIGGER IF EXISTS draw_reward_slots_insert_window ON draw_reward_slots;
    DROP TRIGGER IF EXISTS draw_reward_catalog_snapshots_insert_window ON draw_reward_catalog_snapshots;
    DROP TRIGGER IF EXISTS competition_settlement_inputs_insert_window ON competition_settlement_inputs;
    DROP TRIGGER IF EXISTS draw_entries_insert_window ON draw_entries;
    DROP FUNCTION IF EXISTS gogymgo_enforce_draw_snapshot_insert_window();
  `);
  pgm.dropTable('draw_public_identities');
  pgm.dropTable('draw_reward_slots');
  pgm.dropTable('draw_reward_catalog_snapshots');
  pgm.dropConstraint('competition_draws', 'competition_draws_counts_valid');
  pgm.dropConstraint('competition_draws', 'competition_draws_hash_formats');
  pgm.dropColumns('competition_draws', [
    'public_result_snapshot_hash',
    'reward_slot_count',
    'reward_snapshot_hash',
    'snapshot_finalized_at',
  ]);
}

function replaceRewardAwardIntegrityFunction(
  pgm: MigrationBuilder,
  requireLockedSlot: boolean,
): void {
  const insertIntegrity = requireLockedSlot
    ? `
        SELECT * INTO slot
        FROM draw_reward_slots
        WHERE draw_id = NEW.draw_id
          AND slot_position = NEW.award_rank;
        IF item.id IS NULL
           OR draw_competition_id IS NULL
           OR item.competition_id <> draw_competition_id
           OR slot.draw_id IS NULL
           OR slot.reward_catalog_item_id <> NEW.reward_catalog_item_id THEN
          RAISE EXCEPTION 'award must consume its exact locked reward slot'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_award_locked_slot_integrity';
        END IF;`
    : `
        IF item.id IS NULL
           OR draw_competition_id IS NULL
           OR item.competition_id <> draw_competition_id
           OR item.status::text <> 'published'
           OR item.deleted_at IS NOT NULL
           OR (item.available_from IS NOT NULL AND item.available_from > NEW.awarded_at)
           OR (item.available_until IS NOT NULL AND item.available_until <= NEW.awarded_at) THEN
          RAISE EXCEPTION 'award must use available published inventory from its draw competition'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_award_catalog_integrity';
        END IF;`;
  const slotDeclaration = requireLockedSlot
    ? 'slot draw_reward_slots%ROWTYPE;'
    : '';

  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_reward_award_row_integrity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      draw_competition_id uuid;
      item reward_catalog_items%ROWTYPE;
      ${slotDeclaration}
    BEGIN
      SELECT competition_id INTO draw_competition_id
      FROM competition_draws
      WHERE id = NEW.draw_id;
      SELECT * INTO item
      FROM reward_catalog_items
      WHERE id = NEW.reward_catalog_item_id
      FOR UPDATE;

      IF TG_OP = 'INSERT' THEN
        ${insertIntegrity}

        IF NEW.status::text <> 'awarded' THEN
          RAISE EXCEPTION 'reward awards must begin in awarded status'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_award_initial_status';
        END IF;
      END IF;

      IF NEW.status::text = 'fulfilled' AND item.reward_type::text NOT IN ('physical', 'cash') THEN
        RAISE EXCEPTION 'only physical or cash rewards can be fulfilled'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_type_status';
      END IF;
      IF NEW.status::text = 'claimed' AND item.reward_type::text = 'cash' THEN
        RAISE EXCEPTION 'cash rewards use the in-person fulfillment workflow'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_type_status';
      END IF;
      IF NEW.status::text = 'redeemed' AND item.reward_type::text <> 'coupon' THEN
        RAISE EXCEPTION 'only coupon rewards can be redeemed'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_type_status';
      END IF;

      IF TG_OP = 'UPDATE' THEN
        IF NEW.draw_id IS DISTINCT FROM OLD.draw_id
           OR NEW.reward_catalog_item_id IS DISTINCT FROM OLD.reward_catalog_item_id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.award_rank IS DISTINCT FROM OLD.award_rank
           OR NEW.awarded_at IS DISTINCT FROM OLD.awarded_at THEN
          RAISE EXCEPTION 'reward award identity is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_award_identity_immutable';
        END IF;

        IF NEW.status::text IS DISTINCT FROM OLD.status::text THEN
          IF NOT (
            (OLD.status::text = 'awarded' AND NEW.status::text IN ('claimed', 'cancelled'))
            OR (OLD.status::text = 'awarded' AND item.reward_type::text = 'cash' AND NEW.status::text = 'fulfilled')
            OR (OLD.status::text = 'claimed' AND item.reward_type::text IN ('physical', 'cash') AND NEW.status::text = 'fulfilled')
            OR (OLD.status::text = 'claimed' AND item.reward_type::text = 'coupon' AND NEW.status::text = 'redeemed')
          ) OR NEW.version <> OLD.version + 1 THEN
            RAISE EXCEPTION 'invalid reward award lifecycle transition'
              USING ERRCODE = 'check_violation',
                    CONSTRAINT = 'reward_award_status_transition';
          END IF;
        ELSIF NEW.version IS DISTINCT FROM OLD.version
              OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
              OR NEW.fulfilled_at IS DISTINCT FROM OLD.fulfilled_at
              OR NEW.redeemed_at IS DISTINCT FROM OLD.redeemed_at
              OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
          RAISE EXCEPTION 'reward award lifecycle history is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_award_lifecycle_immutable';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
}
