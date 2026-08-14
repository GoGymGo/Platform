import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(
    "ALTER TYPE social_challenge_status ADD VALUE IF NOT EXISTS 'cancelled'",
  );
  pgm.sql(
    "ALTER TYPE social_challenge_member_status ADD VALUE IF NOT EXISTS 'withdrawn'",
  );

  pgm.addColumns('social_challenges', {
    creation_key_hash: { type: 'char(64)' },
    timezone: { type: 'varchar(64)', notNull: true, default: 'UTC' },
  });
  pgm.sql(`
    UPDATE social_challenges AS challenge
    SET timezone = region.timezone
    FROM region_policies AS region
    WHERE challenge.region_policy_id = region.id
      AND challenge.challenge_type = 'regional'
  `);
  pgm.createIndex('social_challenges', 'creation_key_hash', {
    name: 'social_challenges_creation_key_unique',
    unique: true,
    where: 'creation_key_hash IS NOT NULL',
  });

  pgm.addColumns('social_challenge_members', {
    contact_invitation_id: {
      type: 'uuid',
      references: 'challenge_contact_invitations',
      onDelete: 'SET NULL',
    },
    invitation_source: { type: 'varchar(16)' },
  });
  pgm.sql(`
    UPDATE social_challenge_members AS membership
    SET contact_invitation_id = invitation.id,
        invitation_source = 'contact'
    FROM challenge_contact_invitations AS invitation
    WHERE membership.challenge_id = invitation.challenge_id
      AND membership.user_id = invitation.claimed_by_user_id
      AND invitation.status = 'claimed'
  `);
  pgm.sql(`
    UPDATE social_challenge_members AS membership
    SET invitation_source = CASE
      WHEN membership.role = 'owner' THEN 'owner'
      WHEN challenge.challenge_type = 'regional' THEN 'regional'
      ELSE 'friend'
    END
    FROM social_challenges AS challenge
    WHERE membership.challenge_id = challenge.id
      AND membership.invitation_source IS NULL
  `);
  pgm.alterColumn('social_challenge_members', 'invitation_source', {
    notNull: true,
  });
  pgm.addConstraint(
    'social_challenge_members',
    'social_challenge_members_invitation_source_valid',
    {
      check: "invitation_source IN ('owner', 'friend', 'contact', 'regional')",
    },
  );
  pgm.sql(`
    CREATE UNIQUE INDEX social_relationship_events_idempotency
    ON social_relationship_events (
      actor_user_id,
      action,
      request_id,
      subject_user_id
    ) NULLS NOT DISTINCT
  `);

  pgm.dropConstraint('social_challenges', 'social_challenges_dates_valid');
  pgm.addConstraint('social_challenges', 'social_challenges_dates_valid', {
    check: '(end_date - start_date) BETWEEN 0 AND 30',
  });
  pgm.dropConstraint('social_challenges', 'social_challenges_region_valid');
  pgm.dropConstraint('social_challenges', 'social_challenges_schedule_valid');
  pgm.addConstraint('social_challenges', 'social_challenges_schedule_valid', {
    check: `
      scheduled_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
      AND cardinality(array_positions(scheduled_days, 0::smallint)) <= 1
      AND cardinality(array_positions(scheduled_days, 1::smallint)) <= 1
      AND cardinality(array_positions(scheduled_days, 2::smallint)) <= 1
      AND cardinality(array_positions(scheduled_days, 3::smallint)) <= 1
      AND cardinality(array_positions(scheduled_days, 4::smallint)) <= 1
      AND cardinality(array_positions(scheduled_days, 5::smallint)) <= 1
      AND cardinality(array_positions(scheduled_days, 6::smallint)) <= 1
    `,
  });
  pgm.addConstraint(
    'social_challenges',
    'social_challenges_kind_fields_valid',
    {
      check: `
        (
          challenge_type = 'friend'
          AND region_policy_id IS NULL
          AND location_name IS NULL
          AND cardinality(scheduled_days) = 0
          AND scheduled_time_local IS NULL
          AND participant_limit IS NULL
        ) OR (
          challenge_type = 'regional'
          AND region_policy_id IS NOT NULL
          AND length(trim(location_name)) BETWEEN 2 AND 120
          AND cardinality(scheduled_days) BETWEEN 1 AND 7
          AND scheduled_time_local IS NOT NULL
        )
      `,
    },
  );
  pgm.addConstraint('social_challenges', 'social_challenges_timezone_valid', {
    check: 'length(trim(timezone)) BETWEEN 1 AND 64',
  });

  pgm.dropConstraint(
    'social_challenge_checkins',
    'social_challenge_checkins_workout_session_id_fkey',
    { ifExists: true },
  );
  pgm.addConstraint(
    'social_challenge_checkins',
    'social_challenge_checkins_workout_session_id_fkey',
    {
      foreignKeys: {
        columns: 'workout_session_id',
        references: 'workout_sessions(id)',
        onDelete: 'RESTRICT',
      },
    },
  );

  pgm.dropConstraint(
    'social_relationship_events',
    'social_relationship_events_action_valid',
  );
  pgm.addConstraint(
    'social_relationship_events',
    'social_relationship_events_action_valid',
    {
      check: `action IN (
        'friend_request_sent',
        'friend_request_accepted',
        'friend_request_declined',
        'friend_request_cancelled',
        'friendship_removed',
        'member_blocked',
        'member_unblocked',
        'challenge_created',
        'challenge_friend_invited',
        'challenge_contact_link_created',
        'challenge_contact_link_redeemed',
        'challenge_invitation_accepted',
        'challenge_invitation_declined',
        'challenge_regional_joined',
        'challenge_checkin_recorded',
        'challenge_member_withdrawn',
        'challenge_cancelled'
      )`,
    },
  );

  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_social_challenge_creation_integrity()
    RETURNS trigger AS $$
    DECLARE
      new_challenge_id uuid := NEW.id;
      new_challenge_owner uuid := NEW.owner_user_id;
      new_challenge_kind text := NEW.challenge_type::text;
      new_challenge_region uuid := NEW.region_policy_id;
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM social_challenge_members AS membership
        WHERE membership.challenge_id = new_challenge_id
          AND membership.user_id = new_challenge_owner
          AND membership.role = 'owner'
          AND membership.status = 'accepted'
          AND membership.invitation_source = 'owner'
      ) THEN
        RAISE EXCEPTION 'challenge owner membership is required'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_owner_membership_required';
      END IF;

      IF TG_OP = 'INSERT' AND NOT EXISTS (
        SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone
      ) THEN
        RAISE EXCEPTION 'challenge timezone is not supported'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_timezone_supported';
      END IF;

      IF TG_OP = 'INSERT'
         AND NEW.start_date < (CURRENT_TIMESTAMP AT TIME ZONE NEW.timezone)::date THEN
        RAISE EXCEPTION 'challenge cannot start in the past'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_current_start_required';
      END IF;

      IF TG_OP = 'INSERT' AND new_challenge_kind = 'friend' AND NOT (
        EXISTS (
          SELECT 1
          FROM social_challenge_members AS membership
          WHERE membership.challenge_id = new_challenge_id
            AND membership.role = 'member'
            AND membership.invitation_source = 'friend'
            AND membership.status::text IN ('pending', 'accepted')
        ) OR EXISTS (
          SELECT 1
          FROM challenge_contact_invitations AS invitation
          WHERE invitation.challenge_id = new_challenge_id
            AND invitation.status::text IN ('pending', 'claimed')
        )
      ) THEN
        RAISE EXCEPTION 'friend challenge requires a friend or contact invitation'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_friend_invitation_required';
      END IF;

      IF TG_OP = 'INSERT' AND new_challenge_kind = 'regional' AND NOT EXISTS (
        SELECT 1
        FROM region_verifications AS verification
        INNER JOIN region_policies AS policy
          ON policy.id = verification.region_policy_id
        WHERE verification.user_id = new_challenge_owner
          AND verification.region_policy_id = new_challenge_region
          AND verification.method = 'device_location'
          AND verification.status = 'approved'
          AND verification.verified_at IS NOT NULL
          AND verification.expires_at > CURRENT_TIMESTAMP
          AND verification.policy_version = policy.policy_version
          AND policy.deleted_at IS NULL
          AND policy.competition_enabled = TRUE
          AND policy.valid_from <= CURRENT_TIMESTAMP
          AND (policy.valid_to IS NULL OR policy.valid_to > CURRENT_TIMESTAMP)
      ) THEN
        RAISE EXCEPTION 'current approved region verification is required'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_owner_region_required';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE CONSTRAINT TRIGGER social_challenge_creation_integrity
    AFTER INSERT OR UPDATE ON social_challenges
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION enforce_social_challenge_creation_integrity();

    CREATE OR REPLACE FUNCTION enforce_social_challenge_update_integrity()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
         OR NEW.challenge_type IS DISTINCT FROM OLD.challenge_type
         OR NEW.activity IS DISTINCT FROM OLD.activity
         OR NEW.activity_label IS DISTINCT FROM OLD.activity_label
         OR NEW.name IS DISTINCT FROM OLD.name
         OR NEW.description IS DISTINCT FROM OLD.description
         OR NEW.target_count IS DISTINCT FROM OLD.target_count
         OR NEW.target_period IS DISTINCT FROM OLD.target_period
         OR NEW.start_date IS DISTINCT FROM OLD.start_date
         OR NEW.end_date IS DISTINCT FROM OLD.end_date
         OR NEW.region_policy_id IS DISTINCT FROM OLD.region_policy_id
         OR NEW.location_name IS DISTINCT FROM OLD.location_name
         OR NEW.scheduled_days IS DISTINCT FROM OLD.scheduled_days
         OR NEW.scheduled_time_local IS DISTINCT FROM OLD.scheduled_time_local
         OR NEW.participant_limit IS DISTINCT FROM OLD.participant_limit
         OR NEW.timezone IS DISTINCT FROM OLD.timezone
         OR NEW.creation_key_hash IS DISTINCT FROM OLD.creation_key_hash THEN
        RAISE EXCEPTION 'challenge configuration is immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_configuration_immutable';
      END IF;
      IF NEW.status::text <> OLD.status::text
         AND NOT (
           OLD.status::text = 'active'
           AND NEW.status::text IN ('archived', 'cancelled')
         ) THEN
        RAISE EXCEPTION 'invalid challenge status transition'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_status_transition';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER social_challenge_update_integrity
    BEFORE UPDATE ON social_challenges
    FOR EACH ROW EXECUTE FUNCTION enforce_social_challenge_update_integrity();

    CREATE OR REPLACE FUNCTION enforce_challenge_contact_invitation_integrity()
    RETURNS trigger AS $$
    DECLARE
      invitation_challenge social_challenges%ROWTYPE;
    BEGIN
      SELECT * INTO invitation_challenge
      FROM social_challenges
      WHERE id = NEW.challenge_id;

      IF NOT FOUND
         OR invitation_challenge.challenge_type::text <> 'friend'
         OR invitation_challenge.owner_user_id <> NEW.inviter_user_id
         OR (TG_OP = 'INSERT' AND invitation_challenge.status::text <> 'active') THEN
        RAISE EXCEPTION 'contact invitation requires an owned active friend challenge'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'challenge_contact_invitation_owner_integrity';
      END IF;

      IF TG_OP = 'UPDATE' THEN
        IF NEW.challenge_id IS DISTINCT FROM OLD.challenge_id
           OR NEW.inviter_user_id IS DISTINCT FROM OLD.inviter_user_id
           OR NEW.channel IS DISTINCT FROM OLD.channel
           OR NEW.destination_hash IS DISTINCT FROM OLD.destination_hash
           OR NEW.destination_hint IS DISTINCT FROM OLD.destination_hint
           OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode
           OR NEW.creation_key_hash IS DISTINCT FROM OLD.creation_key_hash
           OR NEW.invite_token_hash IS DISTINCT FROM OLD.invite_token_hash
           OR NEW.token_version IS DISTINCT FROM OLD.token_version
           OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'contact invitation identity is immutable'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'challenge_contact_invitation_immutable';
        END IF;
        IF NEW.status::text <> OLD.status::text
           AND NOT (
             OLD.status::text = 'pending'
             AND NEW.status::text IN ('claimed', 'revoked', 'expired')
           ) THEN
          RAISE EXCEPTION 'invalid contact invitation status transition'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'challenge_contact_invitation_status_transition';
        END IF;
      END IF;

      IF NEW.status::text = 'claimed' THEN
        IF NEW.claimed_by_user_id IS NULL OR NEW.claimed_at IS NULL THEN
          RAISE EXCEPTION 'claimed invitation requires claimant evidence'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'challenge_contact_invitation_claim_evidence';
        END IF;
      ELSIF NEW.claimed_by_user_id IS NOT NULL OR NEW.claimed_at IS NOT NULL THEN
        RAISE EXCEPTION 'unclaimed invitation cannot contain claimant evidence'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'challenge_contact_invitation_claim_evidence';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER challenge_contact_invitation_integrity
    BEFORE INSERT OR UPDATE ON challenge_contact_invitations
    FOR EACH ROW EXECUTE FUNCTION enforce_challenge_contact_invitation_integrity();

    CREATE OR REPLACE FUNCTION enforce_social_challenge_member_integrity()
    RETURNS trigger AS $$
    DECLARE
      challenge social_challenges%ROWTYPE;
      accepted_count integer;
    BEGIN
      SELECT * INTO challenge
      FROM social_challenges
      WHERE id = NEW.challenge_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'challenge does not exist'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF NEW.role = 'owner' THEN
        IF NEW.user_id <> challenge.owner_user_id
           OR NEW.invited_by_user_id <> challenge.owner_user_id
           OR NEW.status::text <> 'accepted'
           OR NEW.invitation_source <> 'owner'
           OR NEW.contact_invitation_id IS NOT NULL THEN
          RAISE EXCEPTION 'invalid challenge owner membership'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'social_challenge_owner_membership_integrity';
        END IF;
        RETURN NEW;
      END IF;

      IF NEW.user_id = challenge.owner_user_id
         OR NEW.invitation_source = 'owner' THEN
        RAISE EXCEPTION 'invalid challenge member role'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_member_role_integrity';
      END IF;

      IF TG_OP = 'UPDATE' AND OLD.status::text <> NEW.status::text THEN
        IF NOT (
          (OLD.status::text = 'pending' AND NEW.status::text IN ('accepted', 'declined', 'withdrawn'))
          OR (OLD.status::text = 'accepted' AND NEW.status::text = 'withdrawn')
          OR (OLD.status::text IN ('declined', 'withdrawn') AND NEW.status::text IN ('pending', 'accepted'))
        ) THEN
          RAISE EXCEPTION 'invalid challenge membership transition'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'social_challenge_membership_transition';
        END IF;
      END IF;

      IF NEW.status::text IN ('pending', 'accepted') THEN
      IF NEW.invitation_source = 'friend' THEN
        IF challenge.challenge_type::text <> 'friend'
           OR NEW.contact_invitation_id IS NOT NULL
           OR NOT EXISTS (
             SELECT 1
             FROM friendships
             WHERE user_a_id = LEAST(challenge.owner_user_id, NEW.user_id)
               AND user_b_id = GREATEST(challenge.owner_user_id, NEW.user_id)
           )
           OR social_pair_is_blocked(challenge.owner_user_id, NEW.user_id) THEN
          RAISE EXCEPTION 'accepted unblocked friendship is required'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'social_challenge_friend_membership_integrity';
        END IF;
      ELSIF NEW.invitation_source = 'contact' THEN
        IF challenge.challenge_type::text <> 'friend'
           OR (TG_OP = 'INSERT' OR OLD.invitation_source IS DISTINCT FROM NEW.invitation_source
               OR OLD.status::text IS DISTINCT FROM NEW.status::text)
              AND (
                NEW.contact_invitation_id IS NULL
                OR NOT EXISTS (
                  SELECT 1
                  FROM challenge_contact_invitations AS invitation
                  WHERE invitation.id = NEW.contact_invitation_id
                    AND invitation.challenge_id = NEW.challenge_id
                    AND invitation.claimed_by_user_id = NEW.user_id
                    AND invitation.status = 'claimed'
                )
              )
           OR social_pair_is_blocked(challenge.owner_user_id, NEW.user_id) THEN
          RAISE EXCEPTION 'claimed contact invitation is required'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'social_challenge_contact_membership_integrity';
        END IF;
      ELSIF NEW.invitation_source = 'regional' THEN
        IF challenge.challenge_type::text <> 'regional'
           OR NEW.status::text <> 'accepted'
           OR NEW.contact_invitation_id IS NOT NULL
           OR social_pair_is_blocked(challenge.owner_user_id, NEW.user_id)
           OR NOT EXISTS (
             SELECT 1
             FROM region_verifications AS verification
             INNER JOIN region_policies AS policy
               ON policy.id = verification.region_policy_id
             WHERE verification.user_id = NEW.user_id
               AND verification.region_policy_id = challenge.region_policy_id
               AND verification.method = 'device_location'
               AND verification.status = 'approved'
               AND verification.verified_at IS NOT NULL
               AND verification.expires_at > CURRENT_TIMESTAMP
               AND verification.policy_version = policy.policy_version
               AND policy.deleted_at IS NULL
               AND policy.competition_enabled = TRUE
               AND policy.valid_from <= CURRENT_TIMESTAMP
               AND (policy.valid_to IS NULL OR policy.valid_to > CURRENT_TIMESTAMP)
           ) THEN
          RAISE EXCEPTION 'current matching region verification is required'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'social_challenge_regional_membership_integrity';
        END IF;
      ELSE
        RAISE EXCEPTION 'invalid challenge membership source'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_membership_source_integrity';
      END IF;
      ELSIF NEW.invitation_source NOT IN ('friend', 'contact', 'regional') THEN
        RAISE EXCEPTION 'invalid challenge membership source'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_membership_source_integrity';
      END IF;

      IF NEW.status::text = 'accepted'
         AND challenge.participant_limit IS NOT NULL
         AND (TG_OP = 'INSERT' OR OLD.status::text <> 'accepted') THEN
        SELECT count(*) INTO accepted_count
        FROM social_challenge_members
        WHERE challenge_id = NEW.challenge_id
          AND status::text = 'accepted';
        IF accepted_count >= challenge.participant_limit THEN
          RAISE EXCEPTION 'challenge participant limit reached'
            USING ERRCODE = 'unique_violation',
                  CONSTRAINT = 'social_challenge_participant_limit';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER social_challenge_member_integrity
    BEFORE INSERT OR UPDATE ON social_challenge_members
    FOR EACH ROW EXECUTE FUNCTION enforce_social_challenge_member_integrity();

    CREATE OR REPLACE FUNCTION withdraw_incompatible_challenge_memberships()
    RETURNS trigger AS $$
    DECLARE
      left_user uuid;
      right_user uuid;
    BEGIN
      IF TG_TABLE_NAME = 'friendships' THEN
        left_user := OLD.user_a_id;
        right_user := OLD.user_b_id;
      ELSE
        left_user := NEW.blocker_user_id;
        right_user := NEW.blocked_user_id;
      END IF;

      UPDATE social_challenge_members AS membership
      SET status = 'withdrawn',
          responded_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      FROM social_challenges AS challenge
      WHERE membership.challenge_id = challenge.id
        AND membership.role = 'member'
        AND membership.status::text IN ('pending', 'accepted')
        AND (
          (challenge.owner_user_id = left_user AND membership.user_id = right_user)
          OR (challenge.owner_user_id = right_user AND membership.user_id = left_user)
        );
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER friendship_challenge_cleanup
    AFTER DELETE ON friendships
    FOR EACH ROW EXECUTE FUNCTION withdraw_incompatible_challenge_memberships();

    CREATE TRIGGER block_challenge_cleanup
    AFTER INSERT ON user_blocks
    FOR EACH ROW EXECUTE FUNCTION withdraw_incompatible_challenge_memberships();

    CREATE OR REPLACE FUNCTION enforce_social_challenge_checkin_integrity()
    RETURNS trigger AS $$
    DECLARE
      challenge social_challenges%ROWTYPE;
    BEGIN
      SELECT * INTO challenge
      FROM social_challenges
      WHERE id = NEW.challenge_id;

      IF NOT FOUND
         OR challenge.status::text <> 'active'
         OR NEW.eligible_date < challenge.start_date
         OR NEW.eligible_date > challenge.end_date
         OR NEW.eligible_date <> (CURRENT_TIMESTAMP AT TIME ZONE challenge.timezone)::date
         OR (cardinality(challenge.scheduled_days) > 0
             AND NOT extract(dow FROM NEW.eligible_date)::integer = ANY(challenge.scheduled_days))
         OR NOT EXISTS (
           SELECT 1
           FROM social_challenge_members AS membership
           WHERE membership.challenge_id = NEW.challenge_id
             AND membership.user_id = NEW.user_id
             AND membership.status::text = 'accepted'
         ) THEN
        RAISE EXCEPTION 'check-in is not eligible for this challenge day'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_checkin_eligibility';
      END IF;

      IF challenge.activity::text = 'gym' THEN
        IF NEW.source::text <> 'verified_workout'
           OR NEW.workout_session_id IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM workout_sessions AS workout
             WHERE workout.id = NEW.workout_session_id
               AND workout.user_id = NEW.user_id
               AND workout.eligible_date = NEW.eligible_date
               AND workout.status = 'verified'
           ) THEN
          RAISE EXCEPTION 'verified workout linkage is required for gym progress'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'social_challenge_checkin_verified_gym_source';
        END IF;
      ELSIF NEW.source::text <> 'manual' OR NEW.workout_session_id IS NOT NULL THEN
        RAISE EXCEPTION 'manual non-gym check-in cannot link a workout'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'social_challenge_checkin_manual_source';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER social_challenge_checkin_integrity
    BEFORE INSERT OR UPDATE ON social_challenge_checkins
    FOR EACH ROW EXECUTE FUNCTION enforce_social_challenge_checkin_integrity();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS social_challenge_checkin_integrity ON social_challenge_checkins',
  );
  pgm.sql('DROP INDEX IF EXISTS social_relationship_events_idempotency');
  pgm.sql('DROP FUNCTION IF EXISTS enforce_social_challenge_checkin_integrity');
  pgm.sql(
    'DROP TRIGGER IF EXISTS challenge_contact_invitation_integrity ON challenge_contact_invitations',
  );
  pgm.sql(
    'DROP FUNCTION IF EXISTS enforce_challenge_contact_invitation_integrity',
  );
  pgm.sql('DROP TRIGGER IF EXISTS block_challenge_cleanup ON user_blocks');
  pgm.sql('DROP TRIGGER IF EXISTS friendship_challenge_cleanup ON friendships');
  pgm.sql(
    'DROP FUNCTION IF EXISTS withdraw_incompatible_challenge_memberships',
  );
  pgm.sql(
    'DROP TRIGGER IF EXISTS social_challenge_member_integrity ON social_challenge_members',
  );
  pgm.sql('DROP FUNCTION IF EXISTS enforce_social_challenge_member_integrity');
  pgm.sql(
    'DROP TRIGGER IF EXISTS social_challenge_update_integrity ON social_challenges',
  );
  pgm.sql('DROP FUNCTION IF EXISTS enforce_social_challenge_update_integrity');
  pgm.sql(
    'DROP TRIGGER IF EXISTS social_challenge_creation_integrity ON social_challenges',
  );
  pgm.sql(
    'DROP FUNCTION IF EXISTS enforce_social_challenge_creation_integrity',
  );

  pgm.dropConstraint(
    'social_relationship_events',
    'social_relationship_events_action_valid',
  );
  pgm.addConstraint(
    'social_relationship_events',
    'social_relationship_events_action_valid',
    {
      check: `action IN (
        'friend_request_sent',
        'friend_request_accepted',
        'friend_request_declined',
        'friend_request_cancelled',
        'friendship_removed',
        'member_blocked',
        'member_unblocked'
      )`,
    },
  );
  pgm.dropConstraint(
    'social_challenge_checkins',
    'social_challenge_checkins_workout_session_id_fkey',
  );
  pgm.addConstraint(
    'social_challenge_checkins',
    'social_challenge_checkins_workout_session_id_fkey',
    {
      foreignKeys: {
        columns: 'workout_session_id',
        references: 'workout_sessions(id)',
        onDelete: 'SET NULL',
      },
    },
  );
  pgm.dropConstraint('social_challenges', 'social_challenges_timezone_valid');
  pgm.dropConstraint(
    'social_challenges',
    'social_challenges_kind_fields_valid',
  );
  pgm.dropConstraint('social_challenges', 'social_challenges_schedule_valid');
  pgm.addConstraint('social_challenges', 'social_challenges_schedule_valid', {
    check: 'scheduled_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]',
  });
  pgm.addConstraint('social_challenges', 'social_challenges_region_valid', {
    check:
      "(challenge_type = 'regional' AND region_policy_id IS NOT NULL) OR " +
      "(challenge_type = 'friend' AND region_policy_id IS NULL)",
  });
  pgm.dropConstraint('social_challenges', 'social_challenges_dates_valid');
  pgm.addConstraint('social_challenges', 'social_challenges_dates_valid', {
    check: 'start_date <= end_date',
  });
  pgm.dropConstraint(
    'social_challenge_members',
    'social_challenge_members_invitation_source_valid',
  );
  pgm.dropColumns('social_challenge_members', [
    'contact_invitation_id',
    'invitation_source',
  ]);
  pgm.dropIndex('social_challenges', 'creation_key_hash', {
    ifExists: true,
    name: 'social_challenges_creation_key_unique',
  });
  pgm.dropColumns('social_challenges', ['creation_key_hash', 'timezone']);
  // PostgreSQL enum values are intentionally retained on rollback.
}
