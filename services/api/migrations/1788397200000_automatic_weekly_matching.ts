import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS competition_matches_direct_partner_provenance
      ON competition_matches;

    ALTER TABLE competition_matches
      DROP CONSTRAINT competition_matches_direct_partner_provenance;
    ALTER TABLE competition_matches
      ADD CONSTRAINT competition_matches_direct_partner_provenance
      CHECK (
        weekly_challenge_request_id IS NULL
        OR user_b_id IS NOT NULL
      );

    CREATE OR REPLACE FUNCTION validate_direct_weekly_challenge_match()
    RETURNS trigger AS $$
    DECLARE
      competition_month_key text;
      distinct_goal_count integer;
      eligible_enrollment_count integer;
      expected_end_date date;
      expected_start_date date;
      request_goal_days smallint;
      request_status weekly_challenge_request_status;
    BEGIN
      SELECT competition.month_key
      INTO competition_month_key
      FROM competitions AS competition
      WHERE competition.id = NEW.competition_id;

      expected_start_date := to_date(
        competition_month_key || '-' ||
        lpad((((NEW.period_index - 1) * 7) + 1)::text, 2, '0'),
        'YYYY-MM-DD'
      );
      expected_end_date := expected_start_date + 6;
      IF NEW.period_start_date <> expected_start_date
         OR NEW.period_end_date <> expected_end_date THEN
        RAISE EXCEPTION 'Weekly Challenge match dates must equal the competition scoring week'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_matches_direct_partner_provenance';
      END IF;

      IF NEW.user_b_id IS NULL THEN
        IF NEW.weekly_challenge_request_id IS NOT NULL THEN
          RAISE EXCEPTION 'solo Weekly Challenge rows cannot reference a request'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_matches_direct_partner_provenance';
        END IF;
        IF NEW.status = 'matched' THEN
          RAISE EXCEPTION 'matched Weekly Challenge rows require two players'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_matches_direct_partner_provenance';
        END IF;
        RETURN NEW;
      END IF;

      IF NEW.status NOT IN ('matched', 'settled', 'cancelled') THEN
        RAISE EXCEPTION 'paired Weekly Challenge rows require a paired status'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_matches_direct_partner_provenance';
      END IF;

      IF NEW.weekly_challenge_request_id IS NOT NULL THEN
        SELECT request.status, request.goal_days
        INTO request_status, request_goal_days
        FROM weekly_challenge_requests AS request
        WHERE request.id = NEW.weekly_challenge_request_id
          AND request.competition_id = NEW.competition_id
          AND request.period_index = NEW.period_index
          AND LEAST(request.requester_user_id, request.recipient_user_id) =
              LEAST(NEW.user_a_id, NEW.user_b_id)
          AND GREATEST(request.requester_user_id, request.recipient_user_id) =
              GREATEST(NEW.user_a_id, NEW.user_b_id);

        IF request_status IS NULL
           OR (NEW.status <> 'cancelled' AND request_status <> 'accepted')
           OR (
             NEW.status = 'cancelled'
             AND request_status NOT IN ('accepted', 'cancelled')
           ) THEN
          RAISE EXCEPTION 'paired Weekly Challenge evidence is not an accepted request'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_matches_direct_partner_provenance';
        END IF;
      END IF;

      IF NEW.status <> 'cancelled' THEN
        SELECT count(*)::integer, count(DISTINCT enrollment.goal_days)::integer
        INTO eligible_enrollment_count, distinct_goal_count
        FROM competition_enrollments AS enrollment
        WHERE enrollment.competition_id = NEW.competition_id
          AND enrollment.status = 'active'
          AND enrollment.user_id IN (NEW.user_a_id, NEW.user_b_id)
          AND (
            request_goal_days IS NULL
            OR enrollment.goal_days = request_goal_days
          );

        IF eligible_enrollment_count <> 2
           OR distinct_goal_count <> 1
           OR EXISTS (
             SELECT 1
             FROM user_blocks AS block
             WHERE (block.blocker_user_id = NEW.user_a_id
                    AND block.blocked_user_id = NEW.user_b_id)
                OR (block.blocker_user_id = NEW.user_b_id
                    AND block.blocked_user_id = NEW.user_a_id)
           )
           OR (
             NEW.weekly_challenge_request_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
               FROM friendships AS friendship
               WHERE friendship.user_a_id = LEAST(NEW.user_a_id, NEW.user_b_id)
                 AND friendship.user_b_id = GREATEST(NEW.user_a_id, NEW.user_b_id)
             )
           ) THEN
          RAISE EXCEPTION 'paired Weekly Challenge players are not currently eligible'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_matches_direct_partner_provenance';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER competition_matches_direct_partner_provenance
    BEFORE INSERT OR UPDATE OF competition_id, period_index, user_a_id,
      user_b_id, status, weekly_challenge_request_id
    ON competition_matches
    FOR EACH ROW EXECUTE FUNCTION validate_direct_weekly_challenge_match();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM competition_matches
        WHERE user_b_id IS NOT NULL
          AND weekly_challenge_request_id IS NULL
          AND status <> 'cancelled'
      ) THEN
        RAISE EXCEPTION 'Automatic Weekly Challenge matches must be preserved; use a forward migration.';
      END IF;
    END;
    $$;

    DROP TRIGGER IF EXISTS competition_matches_direct_partner_provenance
      ON competition_matches;
    ALTER TABLE competition_matches
      DROP CONSTRAINT competition_matches_direct_partner_provenance;
    ALTER TABLE competition_matches
      ADD CONSTRAINT competition_matches_direct_partner_provenance
      CHECK (
        user_b_id IS NULL
        OR weekly_challenge_request_id IS NOT NULL
        OR status IN ('cancelled', 'settled')
      );

    CREATE OR REPLACE FUNCTION validate_direct_weekly_challenge_match()
    RETURNS trigger AS $$
    DECLARE
      competition_month_key text;
      eligible_enrollment_count integer;
      expected_end_date date;
      expected_start_date date;
      request_goal_days smallint;
      request_status weekly_challenge_request_status;
    BEGIN
      SELECT competition.month_key
      INTO competition_month_key
      FROM competitions AS competition
      WHERE competition.id = NEW.competition_id;
      expected_start_date := to_date(
        competition_month_key || '-' ||
        lpad((((NEW.period_index - 1) * 7) + 1)::text, 2, '0'),
        'YYYY-MM-DD'
      );
      expected_end_date := expected_start_date + 6;
      IF NEW.period_start_date <> expected_start_date
         OR NEW.period_end_date <> expected_end_date THEN
        RAISE EXCEPTION 'Weekly Challenge match dates must equal the competition scoring week'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_matches_direct_partner_provenance';
      END IF;
      IF NEW.user_b_id IS NULL THEN
        IF NEW.weekly_challenge_request_id IS NOT NULL OR NEW.status = 'matched' THEN
          RAISE EXCEPTION 'solo Weekly Challenge row is invalid'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_matches_direct_partner_provenance';
        END IF;
        RETURN NEW;
      END IF;
      IF NEW.weekly_challenge_request_id IS NULL THEN
        RAISE EXCEPTION 'paired Weekly Challenge rows require accepted request evidence'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_matches_direct_partner_provenance';
      END IF;
      SELECT request.status, request.goal_days
      INTO request_status, request_goal_days
      FROM weekly_challenge_requests AS request
      WHERE request.id = NEW.weekly_challenge_request_id
        AND request.competition_id = NEW.competition_id
        AND request.period_index = NEW.period_index
        AND LEAST(request.requester_user_id, request.recipient_user_id) =
            LEAST(NEW.user_a_id, NEW.user_b_id)
        AND GREATEST(request.requester_user_id, request.recipient_user_id) =
            GREATEST(NEW.user_a_id, NEW.user_b_id);
      IF request_status IS NULL
         OR (NEW.status <> 'cancelled' AND request_status <> 'accepted')
         OR (NEW.status = 'cancelled' AND request_status NOT IN ('accepted', 'cancelled')) THEN
        RAISE EXCEPTION 'paired Weekly Challenge evidence is not an accepted request'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'competition_matches_direct_partner_provenance';
      END IF;
      IF NEW.status <> 'cancelled' THEN
        SELECT count(*)::integer
        INTO eligible_enrollment_count
        FROM competition_enrollments AS enrollment
        WHERE enrollment.competition_id = NEW.competition_id
          AND enrollment.status = 'active'
          AND enrollment.goal_days = request_goal_days
          AND enrollment.user_id IN (NEW.user_a_id, NEW.user_b_id);
        IF eligible_enrollment_count <> 2
           OR NOT EXISTS (
             SELECT 1 FROM friendships AS friendship
             WHERE friendship.user_a_id = LEAST(NEW.user_a_id, NEW.user_b_id)
               AND friendship.user_b_id = GREATEST(NEW.user_a_id, NEW.user_b_id)
           )
           OR EXISTS (
             SELECT 1 FROM user_blocks AS block
             WHERE (block.blocker_user_id = NEW.user_a_id AND block.blocked_user_id = NEW.user_b_id)
                OR (block.blocker_user_id = NEW.user_b_id AND block.blocked_user_id = NEW.user_a_id)
           ) THEN
          RAISE EXCEPTION 'paired Weekly Challenge players are not currently eligible'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'competition_matches_direct_partner_provenance';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER competition_matches_direct_partner_provenance
    BEFORE INSERT OR UPDATE OF competition_id, period_index, user_a_id,
      user_b_id, status, weekly_challenge_request_id
    ON competition_matches
    FOR EACH ROW EXECUTE FUNCTION validate_direct_weekly_challenge_match();
  `);
}
