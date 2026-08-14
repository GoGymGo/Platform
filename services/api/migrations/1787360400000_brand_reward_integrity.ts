import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('reward_awards', {
    cancelled_at: { type: 'timestamp with time zone' },
    version: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.sql(`
    UPDATE reward_awards
    SET cancelled_at = updated_at
    WHERE status = 'cancelled'
      AND cancelled_at IS NULL
  `);

  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_claim_path');
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_claim_path', {
    check: `
      (
        reward_type = 'coupon'
        AND claim_url IS NULL
        AND fulfillment_instructions IS NULL
      ) OR (
        reward_type <> 'coupon'
        AND (claim_url IS NULL) <> (fulfillment_instructions IS NULL)
      )
    `,
  });
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_content_valid', {
    check: `
      length(trim(sponsor_name)) BETWEEN 2 AND 120
      AND length(trim(title)) BETWEEN 2 AND 160
      AND length(trim(description)) BETWEEN 2 AND 2000
      AND (
        fulfillment_instructions IS NULL
        OR length(trim(fulfillment_instructions)) BETWEEN 2 AND 2000
      )
    `,
  });
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_https_urls', {
    check: `
      (image_url IS NULL OR image_url ~ '^https://[^[:space:]]+$')
      AND (terms_url IS NULL OR terms_url ~ '^https://[^[:space:]]+$')
      AND (claim_url IS NULL OR claim_url ~ '^https://[^[:space:]]+$')
    `,
  });
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_published_assets', {
    check: `
        status <> 'published'
        OR (image_url IS NOT NULL AND terms_url IS NOT NULL)
      `,
  });

  pgm.dropConstraint('reward_awards', 'reward_awards_status_timestamps');
  pgm.addConstraint('reward_awards', 'reward_awards_version_positive', {
    check: 'version > 0',
  });
  pgm.addConstraint('reward_awards', 'reward_awards_status_timestamps', {
    check: `
      (
        status = 'awarded'
        AND claimed_at IS NULL
        AND fulfilled_at IS NULL
        AND redeemed_at IS NULL
        AND cancelled_at IS NULL
      ) OR (
        status = 'cancelled'
        AND claimed_at IS NULL
        AND fulfilled_at IS NULL
        AND redeemed_at IS NULL
        AND cancelled_at IS NOT NULL
      ) OR (
        status = 'claimed'
        AND claimed_at IS NOT NULL
        AND fulfilled_at IS NULL
        AND redeemed_at IS NULL
        AND cancelled_at IS NULL
      ) OR (
        status = 'fulfilled'
        AND claimed_at IS NOT NULL
        AND fulfilled_at IS NOT NULL
        AND redeemed_at IS NULL
        AND cancelled_at IS NULL
      ) OR (
        status = 'redeemed'
        AND claimed_at IS NOT NULL
        AND fulfilled_at IS NULL
        AND redeemed_at IS NOT NULL
        AND cancelled_at IS NULL
      )
    `,
  });
  pgm.addConstraint('reward_coupon_codes', 'reward_coupon_code_format_valid', {
    check: `
        encrypted_code ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
        AND code_fingerprint ~ '^[a-f0-9]{64}$'
      `,
  });
  pgm.addConstraint(
    'reward_coupon_codes',
    'reward_coupon_assignment_timestamps',
    {
      check: `
        (assigned_award_id IS NULL AND assigned_at IS NULL AND redeemed_at IS NULL)
        OR (assigned_award_id IS NOT NULL AND assigned_at IS NOT NULL)
      `,
    },
  );

  pgm.sql(`
    CREATE FUNCTION enforce_reward_catalog_row_integrity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'INSERT' AND NEW.status::text <> 'draft' THEN
        RAISE EXCEPTION 'reward catalog items must begin as drafts'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_catalog_initial_status';
      END IF;

      IF TG_OP = 'UPDATE' THEN
        IF OLD.status::text <> 'draft' AND (
          NEW.competition_id IS DISTINCT FROM OLD.competition_id
          OR NEW.sponsor_name IS DISTINCT FROM OLD.sponsor_name
          OR NEW.title IS DISTINCT FROM OLD.title
          OR NEW.description IS DISTINCT FROM OLD.description
          OR NEW.reward_type IS DISTINCT FROM OLD.reward_type
          OR NEW.image_url IS DISTINCT FROM OLD.image_url
          OR NEW.terms_url IS DISTINCT FROM OLD.terms_url
          OR NEW.claim_url IS DISTINCT FROM OLD.claim_url
          OR NEW.fulfillment_instructions IS DISTINCT FROM OLD.fulfillment_instructions
          OR NEW.inventory_total IS DISTINCT FROM OLD.inventory_total
          OR NEW.display_order IS DISTINCT FROM OLD.display_order
          OR NEW.available_from IS DISTINCT FROM OLD.available_from
          OR NEW.available_until IS DISTINCT FROM OLD.available_until
        ) THEN
          RAISE EXCEPTION 'published reward configuration is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_configuration_immutable';
        END IF;

        IF NEW.status::text IS DISTINCT FROM OLD.status::text AND NOT (
          (OLD.status::text = 'draft' AND NEW.status::text = 'published')
          OR (OLD.status::text = 'published' AND NEW.status::text = 'archived')
        ) THEN
          RAISE EXCEPTION 'invalid reward catalog status transition'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_status_transition';
        END IF;

        IF OLD.deleted_at IS NULL
           AND NEW.deleted_at IS NOT NULL
           AND OLD.status::text NOT IN ('draft', 'archived') THEN
          RAISE EXCEPTION 'published reward must be archived before deletion'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_delete_lifecycle';
        END IF;
        IF OLD.deleted_at IS NOT NULL
           AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
          RAISE EXCEPTION 'deleted reward history is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_delete_immutable';
        END IF;

        IF NEW.version IS DISTINCT FROM OLD.version
           AND NEW.version <> OLD.version + 1 THEN
          RAISE EXCEPTION 'reward catalog version must advance by exactly one'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_version_transition';
        END IF;

        IF (
          NEW.competition_id IS DISTINCT FROM OLD.competition_id
          OR NEW.sponsor_name IS DISTINCT FROM OLD.sponsor_name
          OR NEW.title IS DISTINCT FROM OLD.title
          OR NEW.description IS DISTINCT FROM OLD.description
          OR NEW.reward_type IS DISTINCT FROM OLD.reward_type
          OR NEW.status IS DISTINCT FROM OLD.status
          OR NEW.image_url IS DISTINCT FROM OLD.image_url
          OR NEW.terms_url IS DISTINCT FROM OLD.terms_url
          OR NEW.claim_url IS DISTINCT FROM OLD.claim_url
          OR NEW.fulfillment_instructions IS DISTINCT FROM OLD.fulfillment_instructions
          OR NEW.inventory_total IS DISTINCT FROM OLD.inventory_total
          OR NEW.display_order IS DISTINCT FROM OLD.display_order
          OR NEW.available_from IS DISTINCT FROM OLD.available_from
          OR NEW.available_until IS DISTINCT FROM OLD.available_until
          OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
        ) AND NEW.version <> OLD.version + 1 THEN
          RAISE EXCEPTION 'reward catalog mutation must advance its version'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_version_transition';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER reward_catalog_row_integrity
    BEFORE INSERT OR UPDATE ON reward_catalog_items
    FOR EACH ROW EXECUTE FUNCTION enforce_reward_catalog_row_integrity();

    CREATE FUNCTION enforce_reward_catalog_publication()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      competition_record competitions%ROWTYPE;
      region_record region_policies%ROWTYPE;
      coupon_count integer;
    BEGIN
      IF NEW.status::text <> 'published' THEN
        RETURN NULL;
      END IF;

      SELECT * INTO competition_record
      FROM competitions
      WHERE id = NEW.competition_id;
      SELECT * INTO region_record
      FROM region_policies
      WHERE id = competition_record.region_policy_id;

      IF NOT FOUND
         OR competition_record.deleted_at IS NOT NULL
         OR competition_record.status::text NOT IN ('draft', 'registration')
         OR region_record.deleted_at IS NOT NULL
         OR region_record.competition_enabled IS NOT TRUE
         OR region_record.valid_from > competition_record.registration_opens_at
         OR (
           region_record.valid_to IS NOT NULL
           AND region_record.valid_to <= competition_record.ends_at
         ) THEN
        RAISE EXCEPTION 'published reward requires an eligible configurable competition'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_catalog_publishable_competition';
      END IF;

      IF NEW.reward_type::text = 'coupon' THEN
        SELECT count(*) INTO coupon_count
        FROM reward_coupon_codes
        WHERE reward_catalog_item_id = NEW.id;
        IF coupon_count < NEW.inventory_total THEN
          RAISE EXCEPTION 'published coupon reward requires complete code inventory'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_catalog_coupon_inventory_complete';
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER reward_catalog_publication_integrity
    AFTER INSERT OR UPDATE ON reward_catalog_items
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION enforce_reward_catalog_publication();

    CREATE FUNCTION enforce_reward_award_row_integrity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      draw_competition_id uuid;
      item reward_catalog_items%ROWTYPE;
    BEGIN
      SELECT competition_id INTO draw_competition_id
      FROM competition_draws
      WHERE id = NEW.draw_id;
      SELECT * INTO item
      FROM reward_catalog_items
      WHERE id = NEW.reward_catalog_item_id
      FOR UPDATE;

      IF TG_OP = 'INSERT' THEN
        IF NOT FOUND
           OR draw_competition_id IS NULL
           OR item.competition_id <> draw_competition_id
           OR item.status::text <> 'published'
           OR item.deleted_at IS NOT NULL
           OR (item.available_from IS NOT NULL AND item.available_from > NEW.awarded_at)
           OR (item.available_until IS NOT NULL AND item.available_until <= NEW.awarded_at) THEN
          RAISE EXCEPTION 'award must use available published inventory from its draw competition'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_award_catalog_integrity';
        END IF;

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

    CREATE TRIGGER reward_award_row_integrity
    BEFORE INSERT OR UPDATE ON reward_awards
    FOR EACH ROW EXECUTE FUNCTION enforce_reward_award_row_integrity();

    CREATE FUNCTION enforce_reward_award_settled_draw()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      item_type text;
      assigned_code_count integer;
      redeemed_code_count integer;
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM competition_draws
        WHERE id = NEW.draw_id
          AND status::text = 'settled'
      ) THEN
        RAISE EXCEPTION 'reward awards require a settled draw at commit'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_settled_draw';
      END IF;

      SELECT reward_type::text INTO item_type
      FROM reward_catalog_items
      WHERE id = NEW.reward_catalog_item_id;
      SELECT count(*), count(*) FILTER (WHERE redeemed_at IS NOT NULL)
      INTO assigned_code_count, redeemed_code_count
      FROM reward_coupon_codes
      WHERE assigned_award_id = NEW.id;

      IF item_type = 'coupon'
         AND NEW.status::text IN ('claimed', 'redeemed')
         AND assigned_code_count <> 1 THEN
        RAISE EXCEPTION 'claimed coupon award requires exactly one assigned code'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_coupon_assignment';
      END IF;
      IF item_type = 'coupon'
         AND NEW.status::text = 'redeemed'
         AND redeemed_code_count <> 1 THEN
        RAISE EXCEPTION 'redeemed coupon award requires a redeemed code'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_coupon_redemption';
      END IF;
      IF item_type <> 'coupon' AND assigned_code_count <> 0 THEN
        RAISE EXCEPTION 'non-coupon award cannot have assigned coupon inventory'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_award_coupon_assignment';
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER reward_award_settled_draw_integrity
    AFTER INSERT OR UPDATE ON reward_awards
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION enforce_reward_award_settled_draw();

    CREATE FUNCTION enforce_reward_coupon_code_integrity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      item_type text;
      item_status text;
      item_deleted_at timestamptz;
      award_item_id uuid;
      award_status text;
    BEGIN
      SELECT reward_type::text, status::text, deleted_at
      INTO item_type, item_status, item_deleted_at
      FROM reward_catalog_items
      WHERE id = NEW.reward_catalog_item_id;

      IF item_type IS DISTINCT FROM 'coupon' THEN
        RAISE EXCEPTION 'coupon code inventory requires a coupon reward'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_coupon_item_type';
      END IF;
      IF TG_OP = 'INSERT' AND item_status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'coupon code inventory can only be added to a draft reward'
          USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_coupon_draft_inventory';
      END IF;
      IF TG_OP = 'INSERT' AND item_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'coupon code inventory cannot be added to a deleted reward'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'reward_coupon_live_inventory';
      END IF;

      IF NEW.assigned_award_id IS NOT NULL THEN
        SELECT reward_catalog_item_id, status::text INTO award_item_id, award_status
        FROM reward_awards
        WHERE id = NEW.assigned_award_id;
        IF award_item_id IS DISTINCT FROM NEW.reward_catalog_item_id THEN
          RAISE EXCEPTION 'coupon code and assigned award must use the same reward'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_coupon_award_item_match';
        END IF;
        IF NEW.redeemed_at IS NOT NULL AND award_status IS DISTINCT FROM 'redeemed' THEN
          RAISE EXCEPTION 'coupon redemption requires a redeemed award'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_coupon_award_redeemed';
        END IF;
      END IF;

      IF TG_OP = 'UPDATE' THEN
        IF NEW.reward_catalog_item_id IS DISTINCT FROM OLD.reward_catalog_item_id
           OR NEW.encrypted_code IS DISTINCT FROM OLD.encrypted_code
           OR NEW.code_fingerprint IS DISTINCT FROM OLD.code_fingerprint
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR (
             OLD.assigned_award_id IS NOT NULL
             AND (
               NEW.assigned_award_id IS DISTINCT FROM OLD.assigned_award_id
               OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
             )
           )
           OR (OLD.redeemed_at IS NOT NULL AND NEW.redeemed_at IS DISTINCT FROM OLD.redeemed_at) THEN
          RAISE EXCEPTION 'coupon inventory history is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'reward_coupon_history_immutable';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER reward_coupon_code_integrity
    BEFORE INSERT OR UPDATE ON reward_coupon_codes
    FOR EACH ROW EXECUTE FUNCTION enforce_reward_coupon_code_integrity();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS reward_coupon_code_integrity ON reward_coupon_codes;
    DROP FUNCTION IF EXISTS enforce_reward_coupon_code_integrity();
    DROP TRIGGER IF EXISTS reward_award_settled_draw_integrity ON reward_awards;
    DROP FUNCTION IF EXISTS enforce_reward_award_settled_draw();
    DROP TRIGGER IF EXISTS reward_award_row_integrity ON reward_awards;
    DROP FUNCTION IF EXISTS enforce_reward_award_row_integrity();
    DROP TRIGGER IF EXISTS reward_catalog_publication_integrity ON reward_catalog_items;
    DROP FUNCTION IF EXISTS enforce_reward_catalog_publication();
    DROP TRIGGER IF EXISTS reward_catalog_row_integrity ON reward_catalog_items;
    DROP FUNCTION IF EXISTS enforce_reward_catalog_row_integrity();
  `);

  pgm.dropConstraint(
    'reward_coupon_codes',
    'reward_coupon_assignment_timestamps',
  );
  pgm.dropConstraint('reward_coupon_codes', 'reward_coupon_code_format_valid');
  pgm.dropConstraint('reward_awards', 'reward_awards_status_timestamps');
  pgm.dropConstraint('reward_awards', 'reward_awards_version_positive');
  pgm.addConstraint('reward_awards', 'reward_awards_status_timestamps', {
    check: `
      (status IN ('awarded', 'cancelled') OR claimed_at IS NOT NULL)
      AND (status <> 'fulfilled' OR fulfilled_at IS NOT NULL)
      AND (status <> 'redeemed' OR redeemed_at IS NOT NULL)
    `,
  });
  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_published_assets');
  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_https_urls');
  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_content_valid');
  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_claim_path');
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_claim_path', {
    check:
      "reward_type = 'coupon' OR claim_url IS NOT NULL OR fulfillment_instructions IS NOT NULL",
  });
  pgm.dropColumns('reward_awards', ['cancelled_at', 'version']);
}
