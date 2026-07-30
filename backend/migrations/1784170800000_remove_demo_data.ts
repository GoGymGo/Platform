import type { MigrationBuilder } from 'node-pg-migrate';

export const demoDataCleanupSql = `
    CREATE TEMP TABLE gogymgo_demo_region_ids ON COMMIT DROP AS
    SELECT id
    FROM region_policies
    WHERE code ILIKE '%demo%'
       OR COALESCE(metro_name, '') ILIKE '%demo%'
       OR boundary_version ILIKE '%demo%'
       OR policy_version ILIKE '%demo%';

    CREATE TEMP TABLE gogymgo_demo_competition_ids ON COMMIT DROP AS
    SELECT id
    FROM competitions
    WHERE region_policy_id IN (SELECT id FROM gogymgo_demo_region_ids)
       OR name ILIKE '%demo%'
       OR rules_version ILIKE '%demo%'
       OR rules::text ILIKE '%demo%';

    CREATE TEMP TABLE gogymgo_demo_reward_ids ON COMMIT DROP AS
    SELECT id
    FROM reward_catalog_items
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids)
       OR sponsor_name ILIKE '%demo%'
       OR title ILIKE '%demo%'
       OR description ILIKE '%demo%'
       OR COALESCE(fulfillment_instructions, '') ILIKE '%demo%';

    DELETE FROM partner_applications
    WHERE application_type = 'gym'
      AND LOWER(COALESCE(payload->>'gymName', '')) IN (
        'iron district',
        'volt performance club',
        'northline fitness'
      );

    WITH latest_demo_role_change AS (
      SELECT DISTINCT ON (actor_user_id)
        actor_user_id,
        previous_state,
        next_state
      FROM operator_audit_events
      WHERE action = 'user.bc_demo_operator_bootstrapped'
        AND actor_user_id IS NOT NULL
      ORDER BY actor_user_id, created_at DESC
    )
    UPDATE users AS target
    SET
      roles = ARRAY(
        SELECT jsonb_array_elements_text(change.previous_state->'roles')
      ),
      updated_at = current_timestamp
    FROM latest_demo_role_change AS change
    WHERE target.id = change.actor_user_id
      AND jsonb_typeof(change.previous_state->'roles') = 'array'
      AND jsonb_typeof(change.next_state->'roles') = 'array'
      AND target.roles = ARRAY(
        SELECT jsonb_array_elements_text(change.next_state->'roles')
      );

    ALTER TABLE operator_audit_events
      DISABLE TRIGGER operator_audit_events_append_only;

    DELETE FROM operator_audit_events
    WHERE action IN (
      'foundation.brand_rewards_ready',
      'user.bc_demo_operator_bootstrapped'
    )
      OR entity_id IN (SELECT id FROM gogymgo_demo_region_ids)
      OR entity_id IN (SELECT id FROM gogymgo_demo_competition_ids)
      OR entity_id IN (SELECT id FROM gogymgo_demo_reward_ids)
      OR next_state->>'regionCode' = 'CA-BC-DEMO';

    ALTER TABLE operator_audit_events
      ENABLE TRIGGER operator_audit_events_append_only;

    DELETE FROM idempotency_keys
    WHERE scope LIKE 'demo-verification:%';

    DELETE FROM reward_coupon_codes
    WHERE reward_catalog_item_id IN (SELECT id FROM gogymgo_demo_reward_ids)
       OR assigned_award_id IN (
         SELECT id
         FROM reward_awards
         WHERE draw_id IN (
           SELECT id
           FROM competition_draws
           WHERE competition_id IN (
             SELECT id FROM gogymgo_demo_competition_ids
           )
         )
       );

    DELETE FROM reward_awards
    WHERE reward_catalog_item_id IN (SELECT id FROM gogymgo_demo_reward_ids)
       OR draw_id IN (
         SELECT id
         FROM competition_draws
         WHERE competition_id IN (
           SELECT id FROM gogymgo_demo_competition_ids
         )
       );

    DELETE FROM reward_catalog_items
    WHERE id IN (SELECT id FROM gogymgo_demo_reward_ids);

    DELETE FROM draw_entries
    WHERE draw_id IN (
      SELECT id
      FROM competition_draws
      WHERE competition_id IN (
        SELECT id FROM gogymgo_demo_competition_ids
      )
    );

    DELETE FROM competition_draws
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM session_events
    WHERE session_id IN (
      SELECT id
      FROM workout_sessions
      WHERE competition_id IN (
        SELECT id FROM gogymgo_demo_competition_ids
      )
    );

    DELETE FROM workout_sessions
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM entry_ledger
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM competition_progress
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM competition_matches
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM weekly_challenge_requests
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM competition_enrollments
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM competition_rule_acceptances
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM competition_goal_brackets
    WHERE competition_id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM competitions
    WHERE id IN (SELECT id FROM gogymgo_demo_competition_ids);

    DELETE FROM social_challenges
    WHERE region_policy_id IN (SELECT id FROM gogymgo_demo_region_ids);

    DELETE FROM region_verifications
    WHERE region_policy_id IN (SELECT id FROM gogymgo_demo_region_ids);

    DELETE FROM region_policies
    WHERE id IN (SELECT id FROM gogymgo_demo_region_ids);

    DROP TABLE IF EXISTS demo_verification_checkpoints;
    DROP FUNCTION IF EXISTS gogymgo_reject_demo_verification_update();
`;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(demoDataCleanupSql);
}

export function down(): void {
  throw new Error(
    'Removing demo records and restoring pre-demo roles is intentionally irreversible. Restore a pre-migration backup instead.',
  );
}
