import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addConstraint(
    'competition_enrollments',
    'competition_enrollments_scoring_identity_unique',
    {
      unique: ['id', 'competition_id', 'user_id'],
    },
  );

  for (const table of [
    'workout_sessions',
    'entry_ledger',
    'competition_progress',
  ]) {
    pgm.addConstraint(table, `${table}_enrollment_scoring_identity_fk`, {
      foreignKeys: {
        columns: ['enrollment_id', 'competition_id', 'user_id'],
        references: 'competition_enrollments(id, competition_id, user_id)',
        onDelete: 'RESTRICT',
      },
    });
  }

  pgm.sql(`
    DO $preflight$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM workout_sessions AS session
        INNER JOIN competition_enrollments AS enrollment
          ON enrollment.id = session.enrollment_id
         AND enrollment.competition_id = session.competition_id
         AND enrollment.user_id = session.user_id
        INNER JOIN competitions AS competition
          ON competition.id = session.competition_id
        INNER JOIN region_policies AS region
          ON region.id = competition.region_policy_id
        WHERE session.status = 'verified'
          AND NOT (
            enrollment.gym_location_id IS NOT DISTINCT FROM session.gym_location_id
            AND enrollment.gym_credential_version IS NOT DISTINCT FROM session.gym_credential_version
            AND session.policy_version = competition.rules_version
            AND session.started_at >= enrollment.enrolled_at
            AND session.started_at >= competition.starts_at
            AND session.started_at < competition.ends_at
            AND session.eligible_date = (session.started_at AT TIME ZONE region.timezone)::date
            AND to_char(session.eligible_date, 'YYYY-MM') = competition.month_key
          )
      ) THEN
        RAISE EXCEPTION 'Existing verified workout sessions violate the scoring identity contract.';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM entry_ledger AS entry
        LEFT JOIN workout_sessions AS session
          ON session.id = entry.source_event_id
         AND session.competition_id = entry.competition_id
         AND session.enrollment_id = entry.enrollment_id
         AND session.user_id = entry.user_id
         AND session.policy_version = entry.policy_version
         AND session.status = 'verified'
        WHERE entry.reason = 'verified_session'
          AND (entry.verified_days_delta <> 1 OR session.id IS NULL)
      ) THEN
        RAISE EXCEPTION 'Existing verified-session ledger rows violate the scoring source contract.';
      END IF;
    END;
    $preflight$;

    CREATE FUNCTION gogymgo_enforce_scoring_session_identity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF TG_OP = 'UPDATE'
        AND NEW.status IN ('cancelled', 'rejected')
        AND ROW(
          NEW.competition_id,
          NEW.enrollment_id,
          NEW.user_id,
          NEW.eligible_date,
          NEW.policy_version,
          NEW.started_at,
          NEW.gym_location_id,
          NEW.gym_credential_version
        ) IS NOT DISTINCT FROM ROW(
          OLD.competition_id,
          OLD.enrollment_id,
          OLD.user_id,
          OLD.eligible_date,
          OLD.policy_version,
          OLD.started_at,
          OLD.gym_location_id,
          OLD.gym_credential_version
        )
      THEN
        RETURN NEW;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM competition_enrollments AS enrollment
        INNER JOIN competitions AS competition
          ON competition.id = enrollment.competition_id
        INNER JOIN region_policies AS region
          ON region.id = competition.region_policy_id
        WHERE enrollment.id = NEW.enrollment_id
          AND enrollment.competition_id = NEW.competition_id
          AND enrollment.user_id = NEW.user_id
          AND enrollment.status = 'active'
          AND enrollment.gym_location_id IS NOT DISTINCT FROM NEW.gym_location_id
          AND enrollment.gym_credential_version IS NOT DISTINCT FROM NEW.gym_credential_version
          AND NEW.policy_version = competition.rules_version
          AND NEW.started_at >= enrollment.enrolled_at
          AND NEW.started_at >= competition.starts_at
          AND NEW.started_at < competition.ends_at
          AND NEW.eligible_date = (NEW.started_at AT TIME ZONE region.timezone)::date
          AND to_char(NEW.eligible_date, 'YYYY-MM') = competition.month_key
      ) THEN
        RAISE EXCEPTION 'A scoring session requires its exact active enrollment, gym evidence, rules version, and regional calendar day.';
      END IF;

      RETURN NEW;
    END;
    $function$;

    CREATE TRIGGER workout_sessions_scoring_identity
    BEFORE INSERT OR UPDATE OF competition_id, enrollment_id, user_id,
      eligible_date, policy_version, started_at, gym_location_id,
      gym_credential_version, status
    ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION gogymgo_enforce_scoring_session_identity();

    CREATE FUNCTION gogymgo_enforce_verified_session_ledger_source()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF NEW.reason <> 'verified_session' THEN
        RETURN NEW;
      END IF;

      IF NEW.verified_days_delta <> 1 THEN
        RAISE EXCEPTION 'A verified-session ledger row must grant exactly one verified day.';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM workout_sessions AS session
        WHERE session.id = NEW.source_event_id
          AND session.competition_id = NEW.competition_id
          AND session.enrollment_id = NEW.enrollment_id
          AND session.user_id = NEW.user_id
          AND session.policy_version = NEW.policy_version
          AND session.status = 'verified'
      ) THEN
        RAISE EXCEPTION 'A verified-session ledger row requires its exact verified workout session.';
      END IF;

      RETURN NEW;
    END;
    $function$;

    CREATE TRIGGER entry_ledger_verified_session_source
    BEFORE INSERT ON entry_ledger
    FOR EACH ROW
    EXECUTE FUNCTION gogymgo_enforce_verified_session_ledger_source();
  `);

  pgm.addColumn('competition_draws', {
    scoring_snapshot_hash: { type: 'varchar(64)' },
  });
  pgm.sql(`
    UPDATE competition_draws
    SET scoring_snapshot_hash = entrant_snapshot_hash
    WHERE scoring_snapshot_hash IS NULL;
  `);
  pgm.alterColumn('competition_draws', 'scoring_snapshot_hash', {
    notNull: true,
  });
  pgm.addConstraint(
    'competition_draws',
    'competition_draws_scoring_identity_unique',
    { unique: ['id', 'competition_id', 'rules_version'] },
  );
  pgm.addConstraint(
    'competition_draws',
    'competition_draws_scoring_snapshot_hash_format',
    { check: "scoring_snapshot_hash ~ '^[0-9a-f]{64}$'" },
  );

  pgm.createTable('competition_settlement_inputs', {
    draw_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_draws',
      onDelete: 'RESTRICT',
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    enrollment_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_enrollments',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    goal_days: { type: 'smallint', notNull: true },
    verified_days: { type: 'integer', notNull: true },
    longest_streak: { type: 'integer', notNull: true },
    category_score: { type: 'integer', notNull: true },
    category_rank: { type: 'integer', notNull: true },
    prize_draw_entries: { type: 'integer', notNull: true },
    tie_break_digest: { type: 'varchar(64)', notNull: true },
    rules_version: { type: 'varchar(64)', notNull: true },
    snapshot_position: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_pk',
    { primaryKey: ['draw_id', 'user_id'] },
  );
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_enrollment_identity_fk',
    {
      foreignKeys: {
        columns: ['enrollment_id', 'competition_id', 'user_id'],
        references: 'competition_enrollments(id, competition_id, user_id)',
        onDelete: 'RESTRICT',
      },
    },
  );
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_draw_identity_fk',
    {
      foreignKeys: {
        columns: ['draw_id', 'competition_id', 'rules_version'],
        references: 'competition_draws(id, competition_id, rules_version)',
        onDelete: 'RESTRICT',
      },
    },
  );
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_nonnegative',
    {
      check:
        "goal_days BETWEEN 1 AND 7 AND verified_days >= 0 AND longest_streak >= 0 AND category_score >= 0 AND category_rank > 0 AND prize_draw_entries > 0 AND snapshot_position > 0 AND tie_break_digest ~ '^[0-9a-f]{64}$'",
    },
  );
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_category_rank_unique',
    { unique: ['draw_id', 'goal_days', 'category_rank'] },
  );
  pgm.addConstraint(
    'competition_settlement_inputs',
    'competition_settlement_inputs_position_unique',
    { unique: ['draw_id', 'snapshot_position'] },
  );
  pgm.sql(`
    CREATE TRIGGER competition_settlement_inputs_append_only
    BEFORE UPDATE OR DELETE ON competition_settlement_inputs
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS competition_settlement_inputs_append_only ON competition_settlement_inputs;',
  );
  pgm.dropTable('competition_settlement_inputs');
  pgm.dropConstraint(
    'competition_draws',
    'competition_draws_scoring_snapshot_hash_format',
  );
  pgm.dropConstraint(
    'competition_draws',
    'competition_draws_scoring_identity_unique',
  );
  pgm.dropColumn('competition_draws', 'scoring_snapshot_hash');
  pgm.sql(
    'DROP TRIGGER IF EXISTS entry_ledger_verified_session_source ON entry_ledger;',
  );
  pgm.dropFunction('gogymgo_enforce_verified_session_ledger_source', []);
  pgm.sql(
    'DROP TRIGGER IF EXISTS workout_sessions_scoring_identity ON workout_sessions;',
  );
  pgm.dropFunction('gogymgo_enforce_scoring_session_identity', []);
  for (const table of [
    'competition_progress',
    'entry_ledger',
    'workout_sessions',
  ]) {
    pgm.dropConstraint(table, `${table}_enrollment_scoring_identity_fk`);
  }
  pgm.dropConstraint(
    'competition_enrollments',
    'competition_enrollments_scoring_identity_unique',
  );
}
