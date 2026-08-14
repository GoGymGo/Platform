import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('weekly_challenge_requests', {
    accepted_at: { type: 'timestamp with time zone' },
    cancellation_reason: { type: 'varchar(48)' },
  });
  pgm.addColumns('competition_matches', {
    weekly_challenge_request_id: {
      type: 'uuid',
      references: 'weekly_challenge_requests',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql(`
    UPDATE competition_matches AS match
    SET weekly_challenge_request_id = request.id
    FROM weekly_challenge_requests AS request
    WHERE request.competition_id = match.competition_id
      AND request.period_index = match.period_index
      AND request.status = 'accepted'
      AND match.user_b_id IS NOT NULL
      AND LEAST(request.requester_user_id, request.recipient_user_id) =
          LEAST(match.user_a_id, match.user_b_id)
      AND GREATEST(request.requester_user_id, request.recipient_user_id) =
          GREATEST(match.user_a_id, match.user_b_id)
      AND match.weekly_challenge_request_id IS NULL;

    UPDATE competition_matches
    SET status = 'cancelled',
        settled_at = COALESCE(settled_at, current_timestamp),
        outcome = jsonb_build_object(
          'reason',
          'legacy_unconsented_assignment_removed'
        )
    WHERE status = 'matched'
      AND user_b_id IS NOT NULL
      AND weekly_challenge_request_id IS NULL;

    DELETE FROM competition_matches
    WHERE status = 'searching'
      AND user_b_id IS NULL
      AND outcome IS NULL;

    UPDATE weekly_challenge_requests
    SET accepted_at = COALESCE(responded_at, created_at)
    WHERE status = 'accepted'
      AND accepted_at IS NULL;

    UPDATE weekly_challenge_requests
    SET cancellation_reason = 'legacy_state_reconciled'
    WHERE status = 'cancelled'
      AND cancellation_reason IS NULL;
  `);

  pgm.addConstraint(
    'weekly_challenge_requests',
    'weekly_challenge_request_cancellation_reason',
    {
      check: `
        (status = 'cancelled' AND cancellation_reason IS NOT NULL)
        OR (status <> 'cancelled' AND cancellation_reason IS NULL)
      `,
    },
  );
  pgm.addConstraint(
    'weekly_challenge_requests',
    'weekly_challenge_request_acceptance_evidence',
    {
      check: `
        status <> 'accepted'
        OR accepted_at IS NOT NULL
      `,
    },
  );
  pgm.addConstraint(
    'competition_matches',
    'competition_matches_direct_partner_provenance',
    {
      check: `
        user_b_id IS NULL
        OR weekly_challenge_request_id IS NOT NULL
        OR status IN ('cancelled', 'settled')
      `,
    },
  );
  pgm.createIndex('competition_matches', 'weekly_challenge_request_id', {
    unique: true,
    where: 'weekly_challenge_request_id IS NOT NULL',
  });

  pgm.sql(`
    DROP INDEX competition_matches_user_a_period_unique;
    DROP INDEX competition_matches_user_b_period_unique;
  `);

  pgm.createTable('competition_match_participants', {
    match_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_matches',
      onDelete: 'CASCADE',
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    period_index: { type: 'smallint', notNull: true },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    participant_role: { type: 'char(1)', notNull: true },
    active: { type: 'boolean', notNull: true },
  });
  pgm.createTable('weekly_challenge_assignment_participants', {
    request_id: {
      type: 'uuid',
      notNull: true,
      references: 'weekly_challenge_requests',
      onDelete: 'RESTRICT',
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    period_index: { type: 'smallint', notNull: true },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint(
    'weekly_challenge_assignment_participants',
    'weekly_challenge_assignment_participants_pk',
    { primaryKey: ['request_id', 'user_id'] },
  );
  pgm.addConstraint(
    'weekly_challenge_assignment_participants',
    'weekly_challenge_assignment_participants_one_per_week',
    { unique: ['competition_id', 'period_index', 'user_id'] },
  );
  pgm.addConstraint(
    'weekly_challenge_assignment_participants',
    'weekly_challenge_assignment_participants_period_range',
    { check: 'period_index BETWEEN 1 AND 4' },
  );
  pgm.addConstraint(
    'competition_match_participants',
    'competition_match_participants_pk',
    { primaryKey: ['match_id', 'user_id'] },
  );
  pgm.addConstraint(
    'competition_match_participants',
    'competition_match_participants_period_range',
    { check: 'period_index BETWEEN 1 AND 4' },
  );
  pgm.addConstraint(
    'competition_match_participants',
    'competition_match_participants_role',
    { check: "participant_role IN ('a', 'b')" },
  );
  pgm.sql(`
    CREATE UNIQUE INDEX competition_match_participants_one_active_period
      ON competition_match_participants (competition_id, period_index, user_id)
      WHERE active;

    INSERT INTO weekly_challenge_assignment_participants
      (request_id, competition_id, period_index, user_id)
    SELECT id, competition_id, period_index, requester_user_id
    FROM weekly_challenge_requests
    WHERE accepted_at IS NOT NULL
    UNION ALL
    SELECT id, competition_id, period_index, recipient_user_id
    FROM weekly_challenge_requests
    WHERE accepted_at IS NOT NULL;

    INSERT INTO competition_match_participants
      (match_id, competition_id, period_index, user_id, participant_role, active)
    SELECT id, competition_id, period_index, user_a_id, 'a', status <> 'cancelled'
    FROM competition_matches
    UNION ALL
    SELECT id, competition_id, period_index, user_b_id, 'b', status <> 'cancelled'
    FROM competition_matches
    WHERE user_b_id IS NOT NULL;

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
         OR (
           NEW.status <> 'cancelled'
           AND request_status <> 'accepted'
         )
         OR (
           NEW.status = 'cancelled'
           AND request_status NOT IN ('accepted', 'cancelled')
         ) THEN
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
             SELECT 1
             FROM friendships AS friendship
             WHERE friendship.user_a_id = LEAST(NEW.user_a_id, NEW.user_b_id)
               AND friendship.user_b_id = GREATEST(NEW.user_a_id, NEW.user_b_id)
           )
           OR EXISTS (
             SELECT 1
             FROM user_blocks AS block
             WHERE (block.blocker_user_id = NEW.user_a_id
                    AND block.blocked_user_id = NEW.user_b_id)
                OR (block.blocker_user_id = NEW.user_b_id
                    AND block.blocked_user_id = NEW.user_a_id)
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

    CREATE OR REPLACE FUNCTION sync_competition_match_participants()
    RETURNS trigger AS $$
    BEGIN
      DELETE FROM competition_match_participants WHERE match_id = NEW.id;
      INSERT INTO competition_match_participants
        (match_id, competition_id, period_index, user_id, participant_role, active)
      VALUES
        (
          NEW.id,
          NEW.competition_id,
          NEW.period_index,
          NEW.user_a_id,
          'a',
          NEW.status <> 'cancelled'
        );
      IF NEW.user_b_id IS NOT NULL THEN
        INSERT INTO competition_match_participants
          (match_id, competition_id, period_index, user_id, participant_role, active)
        VALUES
          (
            NEW.id,
            NEW.competition_id,
            NEW.period_index,
            NEW.user_b_id,
            'b',
            NEW.status <> 'cancelled'
          );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER competition_matches_sync_participants
    AFTER INSERT OR UPDATE OF competition_id, period_index, user_a_id,
      user_b_id, status
    ON competition_matches
    FOR EACH ROW EXECUTE FUNCTION sync_competition_match_participants();

    CREATE OR REPLACE FUNCTION record_weekly_challenge_assignment()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.status = 'accepted'
         AND TG_OP = 'INSERT' THEN
        INSERT INTO weekly_challenge_assignment_participants
          (request_id, competition_id, period_index, user_id)
        VALUES
          (NEW.id, NEW.competition_id, NEW.period_index, NEW.requester_user_id),
          (NEW.id, NEW.competition_id, NEW.period_index, NEW.recipient_user_id);
      ELSIF NEW.status = 'accepted'
            AND OLD.status <> 'accepted' THEN
        INSERT INTO weekly_challenge_assignment_participants
          (request_id, competition_id, period_index, user_id)
        VALUES
          (NEW.id, NEW.competition_id, NEW.period_index, NEW.requester_user_id),
          (NEW.id, NEW.competition_id, NEW.period_index, NEW.recipient_user_id);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER weekly_challenge_requests_record_assignment
    AFTER INSERT OR UPDATE OF status ON weekly_challenge_requests
    FOR EACH ROW EXECUTE FUNCTION record_weekly_challenge_assignment();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS weekly_challenge_requests_record_assignment ON weekly_challenge_requests',
  );
  pgm.sql('DROP FUNCTION IF EXISTS record_weekly_challenge_assignment');
  pgm.sql(
    'DROP TRIGGER IF EXISTS competition_matches_sync_participants ON competition_matches',
  );
  pgm.sql('DROP FUNCTION IF EXISTS sync_competition_match_participants');
  pgm.sql(
    'DROP TRIGGER IF EXISTS competition_matches_direct_partner_provenance ON competition_matches',
  );
  pgm.sql('DROP FUNCTION IF EXISTS validate_direct_weekly_challenge_match');
  pgm.dropTable('competition_match_participants');
  pgm.dropTable('weekly_challenge_assignment_participants');
  pgm.sql(`
    CREATE UNIQUE INDEX competition_matches_user_a_period_unique
      ON competition_matches (competition_id, period_index, user_a_id);
    CREATE UNIQUE INDEX competition_matches_user_b_period_unique
      ON competition_matches (competition_id, period_index, user_b_id)
      WHERE user_b_id IS NOT NULL;
  `);
  pgm.dropIndex('competition_matches', 'weekly_challenge_request_id');
  pgm.dropConstraint(
    'competition_matches',
    'competition_matches_direct_partner_provenance',
  );
  pgm.dropConstraint(
    'weekly_challenge_requests',
    'weekly_challenge_request_cancellation_reason',
  );
  pgm.dropConstraint(
    'weekly_challenge_requests',
    'weekly_challenge_request_acceptance_evidence',
  );
  pgm.dropColumn('competition_matches', 'weekly_challenge_request_id');
  pgm.dropColumn('weekly_challenge_requests', 'cancellation_reason');
  pgm.dropColumn('weekly_challenge_requests', 'accepted_at');
}
