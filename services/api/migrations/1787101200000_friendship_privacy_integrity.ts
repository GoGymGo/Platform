import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.sql(
    "ALTER TYPE friend_request_status ADD VALUE IF NOT EXISTS 'cancelled'",
  );

  pgm.createTable('user_blocks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    blocker_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    blocked_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: timestamp,
  });
  pgm.addConstraint('user_blocks', 'user_blocks_distinct_users', {
    check: 'blocker_user_id <> blocked_user_id',
  });
  pgm.addConstraint('user_blocks', 'user_blocks_unique_pair', {
    unique: ['blocker_user_id', 'blocked_user_id'],
  });
  pgm.createIndex('user_blocks', ['blocked_user_id', 'created_at']);

  pgm.createTable('social_relationship_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    actor_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    subject_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL',
    },
    action: { type: 'varchar(40)', notNull: true },
    request_id: { type: 'varchar(128)', notNull: true },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: timestamp,
  });
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
  pgm.createIndex('challenge_contact_invitations', ['status', 'expires_at']);
  pgm.createIndex('social_relationship_events', [
    'actor_user_id',
    'created_at',
  ]);
  pgm.sql(`
    CREATE OR REPLACE FUNCTION reject_social_relationship_event_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'social relationship events are append-only'
        USING ERRCODE = 'check_violation';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER social_relationship_events_append_only
    BEFORE UPDATE OR DELETE ON social_relationship_events
    FOR EACH ROW EXECUTE FUNCTION reject_social_relationship_event_mutation();
  `);

  pgm.addColumns('challenge_contact_invitations', {
    creation_key_hash: {
      type: 'char(64)',
    },
    delivery_mode: {
      type: 'varchar(16)',
      notNull: true,
      default: 'link',
    },
    token_version: { type: 'smallint', notNull: true, default: 1 },
  });
  pgm.addConstraint(
    'challenge_contact_invitations',
    'challenge_contact_invitation_integrity',
    {
      check: `
        delivery_mode = 'link'
        AND token_version = 1
        AND destination_hash ~ '^[a-f0-9]{64}$'
        AND invite_token_hash ~ '^[a-f0-9]{64}$'
        AND creation_key_hash ~ '^[a-f0-9]{64}$'
        AND length(destination_hint) BETWEEN 4 AND 80
        AND expires_at > created_at
      `,
    },
  );
  pgm.addConstraint(
    'challenge_contact_invitations',
    'challenge_contact_invitation_creation_key_unique',
    { unique: ['creation_key_hash'] },
  );

  pgm.addConstraint('profiles', 'profiles_screen_name_not_reserved', {
    check: `upper(screen_name::text) !~ '^(GOGYMGO|ADMIN|ADMINISTRATOR|MODERATOR|OFFICIAL|SUPPORT|SYSTEM)(_|$)'`,
  });

  pgm.sql(`
    CREATE OR REPLACE FUNCTION social_pair_is_blocked(left_user uuid, right_user uuid)
    RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1
        FROM user_blocks
        WHERE (blocker_user_id = left_user AND blocked_user_id = right_user)
           OR (blocker_user_id = right_user AND blocked_user_id = left_user)
      );
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION reject_blocked_friend_request()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.status = 'pending'
         AND social_pair_is_blocked(NEW.requester_user_id, NEW.recipient_user_id) THEN
        RAISE EXCEPTION 'blocked users cannot create pending friend requests'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'friend_requests_block_precedence';
      END IF;
      IF TG_OP = 'UPDATE' AND OLD.status <> 'pending' AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'terminal friend request status is immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'friend_requests_terminal_immutable';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER friend_requests_privacy_integrity
    BEFORE INSERT OR UPDATE ON friend_requests
    FOR EACH ROW EXECUTE FUNCTION reject_blocked_friend_request();

    CREATE OR REPLACE FUNCTION reject_blocked_friendship()
    RETURNS trigger AS $$
    BEGIN
      IF social_pair_is_blocked(NEW.user_a_id, NEW.user_b_id) THEN
        RAISE EXCEPTION 'blocked users cannot be friends'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'friendships_block_precedence';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER friendships_block_precedence
    BEFORE INSERT OR UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION reject_blocked_friendship();

    CREATE OR REPLACE FUNCTION reject_resolved_contact_invitation_mutation()
    RETURNS trigger AS $$
    BEGIN
      IF OLD.status <> 'pending' AND (
        NEW.status <> OLD.status
        OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
        OR NEW.claimed_by_user_id IS DISTINCT FROM OLD.claimed_by_user_id
      ) THEN
        RAISE EXCEPTION 'resolved contact invitation is immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'challenge_contact_invitation_terminal_immutable';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER challenge_contact_invitation_terminal_immutable
    BEFORE UPDATE ON challenge_contact_invitations
    FOR EACH ROW EXECUTE FUNCTION reject_resolved_contact_invitation_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS challenge_contact_invitation_terminal_immutable ON challenge_contact_invitations',
  );
  pgm.sql(
    'DROP FUNCTION IF EXISTS reject_resolved_contact_invitation_mutation',
  );
  pgm.sql('DROP TRIGGER IF EXISTS friendships_block_precedence ON friendships');
  pgm.sql('DROP FUNCTION IF EXISTS reject_blocked_friendship');
  pgm.sql(
    'DROP TRIGGER IF EXISTS friend_requests_privacy_integrity ON friend_requests',
  );
  pgm.sql('DROP FUNCTION IF EXISTS reject_blocked_friend_request');
  pgm.sql('DROP FUNCTION IF EXISTS social_pair_is_blocked');
  pgm.dropConstraint('profiles', 'profiles_screen_name_not_reserved');
  pgm.dropConstraint(
    'challenge_contact_invitations',
    'challenge_contact_invitation_creation_key_unique',
  );
  pgm.dropConstraint(
    'challenge_contact_invitations',
    'challenge_contact_invitation_integrity',
  );
  pgm.dropIndex('challenge_contact_invitations', ['status', 'expires_at']);
  pgm.dropColumns('challenge_contact_invitations', [
    'delivery_mode',
    'creation_key_hash',
    'token_version',
  ]);
  pgm.sql(
    'DROP TRIGGER IF EXISTS social_relationship_events_append_only ON social_relationship_events',
  );
  pgm.sql('DROP FUNCTION IF EXISTS reject_social_relationship_event_mutation');
  pgm.dropTable('social_relationship_events');
  pgm.dropTable('user_blocks');
  // PostgreSQL enum values are intentionally retained on rollback. Removing an
  // enum label is unsafe while older application processes may still reference it.
}
