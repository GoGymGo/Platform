import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    WITH settled_scores AS (
      SELECT
        match.competition_id,
        (result.value->>'userId')::uuid AS user_id,
        SUM(
          enrollment.goal_days *
          GREATEST((result.value->>'multiplier')::integer, 0)
        )::integer AS score
      FROM competition_matches AS match
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(match.outcome->'results', '[]'::jsonb)
      ) AS result(value)
      INNER JOIN competition_enrollments AS enrollment
        ON enrollment.competition_id = match.competition_id
       AND enrollment.user_id = (result.value->>'userId')::uuid
      WHERE match.status = 'settled'
      GROUP BY match.competition_id, (result.value->>'userId')::uuid
    ),
    unsettled_scores AS (
      SELECT
        session.competition_id,
        session.user_id,
        COUNT(DISTINCT session.eligible_date)::integer AS score
      FROM workout_sessions AS session
      WHERE session.status = 'verified'
        AND EXTRACT(DAY FROM session.eligible_date) <= 28
        AND NOT EXISTS (
          SELECT 1
          FROM competition_matches AS match
          WHERE match.competition_id = session.competition_id
            AND match.status = 'settled'
            AND session.eligible_date BETWEEN
              match.period_start_date AND match.period_end_date
            AND session.user_id IN (match.user_a_id, match.user_b_id)
        )
      GROUP BY session.competition_id, session.user_id
    ),
    corrections AS (
      SELECT
        progress.competition_id,
        progress.enrollment_id,
        progress.goal_days,
        progress.user_id,
        competition.rules_version,
        (
          COALESCE(settled.score, 0) +
          COALESCE(unsettled.score, 0) -
          progress.category_score
        )::integer AS score_delta
      FROM competition_progress AS progress
      INNER JOIN competitions AS competition
        ON competition.id = progress.competition_id
      LEFT JOIN settled_scores AS settled
        ON settled.competition_id = progress.competition_id
       AND settled.user_id = progress.user_id
      LEFT JOIN unsettled_scores AS unsettled
        ON unsettled.competition_id = progress.competition_id
       AND unsettled.user_id = progress.user_id
      WHERE competition.status IN ('settling', 'settled')
        AND EXISTS (
          SELECT 1
          FROM competition_matches AS match
          WHERE match.competition_id = progress.competition_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM competition_matches AS match
          WHERE match.competition_id = progress.competition_id
            AND match.status <> 'settled'
        )
    ),
    inserted AS (
      INSERT INTO entry_ledger (
        competition_id,
        enrollment_id,
        user_id,
        reason,
        source_event_id,
        verified_days_delta,
        category_score_delta,
        prize_draw_entries_delta,
        policy_version,
        metadata
      )
      SELECT
        correction.competition_id,
        correction.enrollment_id,
        correction.user_id,
        'operator_adjustment'::ledger_reason,
        correction.enrollment_id,
        0,
        correction.score_delta,
        0,
        correction.rules_version,
        jsonb_build_object(
          'source', 'canonical_goal_score_reconciliation',
          'goalDays', correction.goal_days
        )
      FROM corrections AS correction
      WHERE correction.score_delta <> 0
      ON CONFLICT (competition_id, user_id, reason, source_event_id)
      DO NOTHING
      RETURNING competition_id, user_id, category_score_delta
    )
    UPDATE competition_progress AS progress
    SET
      category_score = progress.category_score + inserted.category_score_delta,
      updated_at = current_timestamp
    FROM inserted
    WHERE progress.competition_id = inserted.competition_id
      AND progress.user_id = inserted.user_id;
  `);
}

export function down(): void {
  // Goal-score corrections are append-only ledger events and are not reversed.
}
