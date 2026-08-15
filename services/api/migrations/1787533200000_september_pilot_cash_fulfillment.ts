import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('reward_catalog_items', {
    cash_amount_cents: { type: 'integer' },
    cash_currency: { type: 'char(3)' },
  });
  pgm.addColumns('draw_reward_catalog_snapshots', {
    cash_amount_cents: { type: 'integer' },
    cash_currency: { type: 'char(3)' },
  });
  pgm.addColumn('cash_fulfillments', {
    reward_award_version: { type: 'integer' },
  });
  pgm.sql(`
    UPDATE reward_catalog_items AS reward
    SET cash_amount_cents = value.amount_cents,
        cash_currency = value.currency
    FROM (
      SELECT award.reward_catalog_item_id,
             min(cash.amount_cents)::integer AS amount_cents,
             min(cash.currency)::char(3) AS currency
      FROM cash_fulfillments AS cash
      JOIN reward_awards AS award ON award.id = cash.reward_award_id
      GROUP BY award.reward_catalog_item_id
      HAVING count(DISTINCT cash.amount_cents) = 1
         AND count(DISTINCT cash.currency) = 1
    ) AS value
    WHERE reward.id = value.reward_catalog_item_id;

    UPDATE draw_reward_catalog_snapshots AS snapshot
    SET cash_amount_cents = reward.cash_amount_cents,
        cash_currency = reward.cash_currency
    FROM reward_catalog_items AS reward
    WHERE reward.id = snapshot.reward_catalog_item_id;

    UPDATE cash_fulfillments AS cash
    SET reward_award_version = greatest(award.version - 1, 1)
    FROM reward_awards AS award
    WHERE award.id = cash.reward_award_id;

    ALTER TABLE cash_fulfillments
      ALTER COLUMN reward_award_version SET NOT NULL;

    ALTER TABLE reward_catalog_items
      DROP CONSTRAINT reward_catalog_claim_path;
    ALTER TABLE reward_catalog_items
      ADD CONSTRAINT reward_catalog_claim_path CHECK (
        (
          reward_type = 'coupon'
          AND claim_url IS NULL
          AND fulfillment_instructions IS NULL
        ) OR (
          reward_type = 'cash'
          AND claim_url IS NULL
          AND fulfillment_instructions IS NOT NULL
        ) OR (
          reward_type = 'physical'
          AND (claim_url IS NULL) <> (fulfillment_instructions IS NULL)
        )
      ) NOT VALID;
    ALTER TABLE reward_catalog_items
      ADD CONSTRAINT reward_catalog_cash_value CHECK (
        (
          reward_type = 'cash'
          AND (
            status <> 'published'
            OR (
              cash_amount_cents > 0
              AND cash_currency ~ '^[A-Z]{3}$'
            )
          )
        ) OR (
          reward_type <> 'cash'
          AND cash_amount_cents IS NULL
          AND cash_currency IS NULL
        )
      ) NOT VALID;
    ALTER TABLE draw_reward_catalog_snapshots
      ADD CONSTRAINT draw_reward_snapshot_cash_value CHECK (
        (
          reward_type = 'cash'
          AND cash_amount_cents > 0
          AND cash_currency ~ '^[A-Z]{3}$'
        ) OR (
          reward_type <> 'cash'
          AND cash_amount_cents IS NULL
          AND cash_currency IS NULL
        )
      ) NOT VALID;
    ALTER TABLE cash_fulfillments
      ADD CONSTRAINT cash_fulfillments_note_bounded
      CHECK (length(trim(fulfillment_note)) BETWEEN 8 AND 500) NOT VALID;
    ALTER TABLE cash_fulfillments
      ADD CONSTRAINT cash_fulfillments_award_version_positive
      CHECK (reward_award_version > 0) NOT VALID;

    CREATE FUNCTION gogymgo_enforce_cash_catalog_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'UPDATE'
         AND (
           NEW.cash_amount_cents IS DISTINCT FROM OLD.cash_amount_cents
           OR NEW.cash_currency IS DISTINCT FROM OLD.cash_currency
         ) THEN
        IF OLD.status::text <> 'draft' THEN
          RAISE EXCEPTION 'published cash reward value is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_configuration_immutable';
        END IF;
        IF NEW.version <> OLD.version + 1 THEN
          RAISE EXCEPTION 'cash reward value mutation must advance its version'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_version_transition';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER reward_catalog_cash_mutation
    BEFORE UPDATE ON reward_catalog_items
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_cash_catalog_mutation();

    CREATE FUNCTION gogymgo_enforce_september_pilot_reward()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      competition_record competitions%ROWTYPE;
      target_competition_id uuid;
      region_code text;
      published_count integer;
      exact_count integer;
    BEGIN
      target_competition_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.competition_id
        ELSE NEW.competition_id
      END;
      SELECT competition.*
      INTO competition_record
      FROM competitions AS competition
      WHERE competition.id = target_competition_id;
      SELECT code INTO region_code
      FROM region_policies
      WHERE id = competition_record.region_policy_id;

      IF competition_record.month_key = '2026-09'
         AND competition_record.name = 'GoGymGo September 2026 Island Pilot'
         AND region_code = 'vancouver-island-gulf-islands-bc'
         AND (
           (TG_OP <> 'DELETE' AND NEW.status::text = 'published')
           OR competition_record.status::text IN ('registration', 'locked', 'settled')
         ) THEN
        SELECT count(*)::integer,
               count(*) FILTER (
                 WHERE reward_type::text = 'cash'
                   AND sponsor_name = 'GoGymGo'
                   AND title = 'GoGymGo $100 CAD Cash Reward'
                   AND cash_amount_cents = 10000
                   AND cash_currency = 'CAD'
                   AND inventory_total = 1
                   AND claim_url IS NULL
                   AND fulfillment_instructions IS NOT NULL
                   AND image_url IS NOT NULL
                   AND terms_url IS NOT NULL
                   AND lower(image_url) !~ '^https://([^/@]+@)?([^/]*\\.)?(example\\.(com|net|org)|localhost)([:/]|$)'
                   AND lower(terms_url) !~ '^https://([^/@]+@)?([^/]*\\.)?(example\\.(com|net|org)|localhost)([:/]|$)'
               )::integer
        INTO published_count, exact_count
        FROM reward_catalog_items
        WHERE competition_id = target_competition_id
          AND status::text = 'published'
          AND deleted_at IS NULL;
        IF published_count <> 1
           OR exact_count <> 1 THEN
          RAISE EXCEPTION 'September pilot requires exactly one approved $100 CAD GoGymGo cash reward'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'september_pilot_exact_cash_reward';
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER september_pilot_reward_integrity
    AFTER INSERT OR UPDATE OR DELETE ON reward_catalog_items
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_september_pilot_reward();

    CREATE FUNCTION gogymgo_enforce_september_pilot_publication()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      region_code text;
      exact_reward_count integer;
      published_reward_count integer;
    BEGIN
      IF NEW.status::text <> 'registration'
         OR NEW.month_key <> '2026-09'
         OR NEW.name <> 'GoGymGo September 2026 Island Pilot' THEN
        RETURN NULL;
      END IF;
      SELECT code INTO region_code
      FROM region_policies
      WHERE id = NEW.region_policy_id;
      IF region_code <> 'vancouver-island-gulf-islands-bc' THEN
        RETURN NULL;
      END IF;
      SELECT count(*)::integer,
             count(*) FILTER (
               WHERE reward_type::text = 'cash'
                 AND sponsor_name = 'GoGymGo'
                 AND title = 'GoGymGo $100 CAD Cash Reward'
                 AND cash_amount_cents = 10000
                 AND cash_currency = 'CAD'
                 AND inventory_total = 1
                 AND claim_url IS NULL
                 AND fulfillment_instructions IS NOT NULL
                 AND image_url IS NOT NULL
                 AND terms_url IS NOT NULL
             )::integer
      INTO published_reward_count, exact_reward_count
      FROM reward_catalog_items
      WHERE competition_id = NEW.id
        AND status::text = 'published'
        AND deleted_at IS NULL;
      IF published_reward_count <> 1 OR exact_reward_count <> 1 THEN
        RAISE EXCEPTION 'September pilot publication requires its exact sole cash reward'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'september_pilot_publication_reward';
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER september_pilot_publication_integrity
    AFTER INSERT OR UPDATE ON competitions
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_september_pilot_publication();

    CREATE FUNCTION gogymgo_enforce_september_pilot_draw_reward()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      competition_record competitions%ROWTYPE;
      region_code text;
      exact_snapshot_count integer;
      exact_slot_count integer;
    BEGIN
      IF NEW.status::text NOT IN ('locked', 'settled')
         OR NEW.snapshot_finalized_at IS NULL THEN
        RETURN NULL;
      END IF;
      SELECT competition.*
      INTO competition_record
      FROM competitions AS competition
      WHERE competition.id = NEW.competition_id;
      SELECT code INTO region_code
      FROM region_policies
      WHERE id = competition_record.region_policy_id;
      IF competition_record.month_key <> '2026-09'
         OR competition_record.name <> 'GoGymGo September 2026 Island Pilot'
         OR region_code <> 'vancouver-island-gulf-islands-bc' THEN
        RETURN NULL;
      END IF;
      SELECT count(*)::integer INTO exact_snapshot_count
      FROM draw_reward_catalog_snapshots
      WHERE draw_id = NEW.id
        AND reward_type::text = 'cash'
        AND sponsor_name = 'GoGymGo'
        AND title = 'GoGymGo $100 CAD Cash Reward'
        AND cash_amount_cents = 10000
        AND cash_currency = 'CAD'
        AND inventory_total = 1
        AND available_slot_count = 1;
      SELECT count(*)::integer INTO exact_slot_count
      FROM draw_reward_slots
      WHERE draw_id = NEW.id
        AND slot_position = 1
        AND catalog_slot_position = 1;
      IF NEW.reward_slot_count <> 1
         OR exact_snapshot_count <> 1
         OR exact_slot_count <> 1 THEN
        RAISE EXCEPTION 'September pilot draw must lock exactly one $100 CAD reward slot'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'september_pilot_draw_reward_snapshot';
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER september_pilot_draw_reward_integrity
    AFTER INSERT OR UPDATE ON competition_draws
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_september_pilot_draw_reward();

    CREATE FUNCTION gogymgo_enforce_cash_fulfillment_write()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      award reward_awards%ROWTYPE;
      actor users%ROWTYPE;
      draw_status text;
      competition_status text;
      competition_month_key text;
      competition_name text;
      region_code text;
      snapshot draw_reward_catalog_snapshots%ROWTYPE;
      slot draw_reward_slots%ROWTYPE;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'cash fulfillment evidence is append-only'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_fulfillments_append_only';
      END IF;

      SELECT * INTO award
      FROM reward_awards
      WHERE id = NEW.reward_award_id
      FOR UPDATE;
      SELECT draw.status::text, competition.status::text,
             competition.month_key, competition.name, region.code
      INTO draw_status, competition_status, competition_month_key,
           competition_name, region_code
      FROM competition_draws AS draw
      JOIN competitions AS competition ON competition.id = draw.competition_id
      JOIN region_policies AS region ON region.id = competition.region_policy_id
      WHERE draw.id = award.draw_id;
      SELECT * INTO slot
      FROM draw_reward_slots
      WHERE draw_id = award.draw_id
        AND slot_position = award.award_rank;
      SELECT * INTO snapshot
      FROM draw_reward_catalog_snapshots
      WHERE draw_id = award.draw_id
        AND reward_catalog_item_id = slot.reward_catalog_item_id;
      SELECT * INTO actor
      FROM users
      WHERE id = NEW.fulfilled_by_user_id;

      IF award.id IS NULL
         OR award.status::text <> 'awarded'
         OR award.version <> NEW.reward_award_version
         OR draw_status <> 'settled'
         OR competition_status <> 'settled'
         OR competition_month_key <> '2026-09'
         OR competition_name <> 'GoGymGo September 2026 Island Pilot'
         OR region_code <> 'vancouver-island-gulf-islands-bc'
         OR NEW.competition_id IS DISTINCT FROM (
           SELECT competition_id FROM competition_draws WHERE id = award.draw_id
         )
         OR NEW.winner_user_id IS DISTINCT FROM award.user_id
         OR award.award_rank <> 1
         OR slot.reward_catalog_item_id IS DISTINCT FROM award.reward_catalog_item_id
         OR slot.catalog_slot_position <> 1
         OR snapshot.reward_type::text <> 'cash'
         OR snapshot.sponsor_name <> 'GoGymGo'
         OR snapshot.title <> 'GoGymGo $100 CAD Cash Reward'
         OR snapshot.cash_amount_cents <> 10000
         OR snapshot.cash_currency <> 'CAD'
         OR snapshot.inventory_total <> 1
         OR snapshot.available_slot_count <> 1
         OR NEW.amount_cents <> snapshot.cash_amount_cents
         OR NEW.currency <> snapshot.cash_currency THEN
        RAISE EXCEPTION 'cash fulfillment does not match the settled September pilot award snapshot'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_fulfillment_settled_award_integrity';
      END IF;
      IF actor.id IS NULL
         OR actor.status::text <> 'active'
         OR actor.email_verified IS NOT TRUE
         OR NOT (actor.roles @> ARRAY['admin']::text[])
         OR actor.roles && ARRAY['gym_partner_admin', 'gym_partner_staff']::text[]
         OR EXISTS (
           SELECT 1 FROM gym_partner_assignments
           WHERE user_id = actor.id AND active IS TRUE
         ) THEN
        RAISE EXCEPTION 'cash fulfillment requires an exact unscoped database administrator'
          USING ERRCODE = 'insufficient_privilege',
                CONSTRAINT = 'cash_fulfillment_admin_authority';
      END IF;
      IF NEW.amount_cents <> 10000 OR NEW.currency <> 'CAD' THEN
        RAISE EXCEPTION 'September pilot cash fulfillment must be exactly $100 CAD'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_fulfillment_exact_value';
      END IF;
      IF NEW.fulfilled_at IS DISTINCT FROM NEW.created_at THEN
        RAISE EXCEPTION 'cash fulfillment timestamps must be server-coincident'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_fulfillment_server_timestamp';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER cash_fulfillment_write_integrity
    BEFORE INSERT OR UPDATE OR DELETE ON cash_fulfillments
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_cash_fulfillment_write();

    CREATE FUNCTION gogymgo_require_cash_record_for_award_fulfillment()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      reward_type text;
    BEGIN
      SELECT snapshot.reward_type::text INTO reward_type
      FROM draw_reward_slots AS slot
      JOIN draw_reward_catalog_snapshots AS snapshot
        ON snapshot.draw_id = slot.draw_id
       AND snapshot.reward_catalog_item_id = slot.reward_catalog_item_id
      WHERE slot.draw_id = NEW.draw_id
        AND slot.slot_position = NEW.award_rank;
      IF reward_type = 'cash'
         AND NEW.status::text = 'fulfilled'
         AND NOT EXISTS (
           SELECT 1 FROM cash_fulfillments
           WHERE reward_award_id = NEW.id
             AND reward_award_version = OLD.version
             AND fulfilled_at = NEW.fulfilled_at
         ) THEN
        RAISE EXCEPTION 'cash awards require an immutable manual handoff record'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_award_fulfillment_record_required';
      END IF;
      IF reward_type = 'cash'
         AND NEW.status::text IS DISTINCT FROM OLD.status::text
         AND NOT (
           OLD.status::text = 'awarded'
           AND NEW.status::text IN ('cancelled', 'fulfilled')
         ) THEN
        RAISE EXCEPTION 'cash award lifecycle must use cancellation or manual handoff'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_award_lifecycle';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER cash_award_fulfillment_record_required
    BEFORE UPDATE ON reward_awards
    FOR EACH ROW EXECUTE FUNCTION gogymgo_require_cash_record_for_award_fulfillment();

    CREATE FUNCTION gogymgo_enforce_cash_fulfillment_commit()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      award reward_awards%ROWTYPE;
      audit_count integer;
    BEGIN
      SELECT * INTO award FROM reward_awards WHERE id = NEW.reward_award_id;
      SELECT count(*)::integer INTO audit_count
      FROM operator_audit_events
      WHERE entity_type = 'cash_fulfillments'
        AND entity_id = NEW.id
        AND action = 'cash_fulfillment.recorded'
        AND actor_user_id = NEW.fulfilled_by_user_id;
      IF award.status::text <> 'fulfilled'
         OR award.version <> NEW.reward_award_version + 1
         OR award.claimed_at IS DISTINCT FROM NEW.fulfilled_at
         OR award.fulfilled_at IS DISTINCT FROM NEW.fulfilled_at
         OR audit_count <> 1 THEN
        RAISE EXCEPTION 'cash fulfillment commit requires matching award state and one audit event'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'cash_fulfillment_commit_integrity';
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER cash_fulfillment_commit_integrity
    AFTER INSERT ON cash_fulfillments
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_cash_fulfillment_commit();

    CREATE UNIQUE INDEX cash_fulfillment_audit_unique
    ON operator_audit_events (entity_id, action)
    WHERE entity_type = 'cash_fulfillments'
      AND action = 'cash_fulfillment.recorded';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS cash_fulfillment_audit_unique;
    DROP TRIGGER IF EXISTS cash_fulfillment_commit_integrity ON cash_fulfillments;
    DROP FUNCTION IF EXISTS gogymgo_enforce_cash_fulfillment_commit();
    DROP TRIGGER IF EXISTS cash_award_fulfillment_record_required ON reward_awards;
    DROP FUNCTION IF EXISTS gogymgo_require_cash_record_for_award_fulfillment();
    DROP TRIGGER IF EXISTS cash_fulfillment_write_integrity ON cash_fulfillments;
    DROP FUNCTION IF EXISTS gogymgo_enforce_cash_fulfillment_write();
    DROP TRIGGER IF EXISTS september_pilot_draw_reward_integrity ON competition_draws;
    DROP FUNCTION IF EXISTS gogymgo_enforce_september_pilot_draw_reward();
    DROP TRIGGER IF EXISTS september_pilot_publication_integrity ON competitions;
    DROP FUNCTION IF EXISTS gogymgo_enforce_september_pilot_publication();
    DROP TRIGGER IF EXISTS september_pilot_reward_integrity ON reward_catalog_items;
    DROP FUNCTION IF EXISTS gogymgo_enforce_september_pilot_reward();
    DROP TRIGGER IF EXISTS reward_catalog_cash_mutation ON reward_catalog_items;
    DROP FUNCTION IF EXISTS gogymgo_enforce_cash_catalog_mutation();
    ALTER TABLE cash_fulfillments
      DROP CONSTRAINT IF EXISTS cash_fulfillments_award_version_positive,
      DROP CONSTRAINT IF EXISTS cash_fulfillments_note_bounded;
    ALTER TABLE draw_reward_catalog_snapshots
      DROP CONSTRAINT IF EXISTS draw_reward_snapshot_cash_value;
    ALTER TABLE reward_catalog_items
      DROP CONSTRAINT IF EXISTS reward_catalog_cash_value,
      DROP CONSTRAINT IF EXISTS reward_catalog_claim_path;
    ALTER TABLE reward_catalog_items
      ADD CONSTRAINT reward_catalog_claim_path CHECK (
        (
          reward_type = 'coupon'
          AND claim_url IS NULL
          AND fulfillment_instructions IS NULL
        ) OR (
          reward_type <> 'coupon'
          AND (claim_url IS NULL) <> (fulfillment_instructions IS NULL)
        )
      ) NOT VALID;
  `);
  pgm.dropColumn('cash_fulfillments', 'reward_award_version');
  pgm.dropColumns('draw_reward_catalog_snapshots', [
    'cash_amount_cents',
    'cash_currency',
  ]);
  pgm.dropColumns('reward_catalog_items', [
    'cash_amount_cents',
    'cash_currency',
  ]);
}
