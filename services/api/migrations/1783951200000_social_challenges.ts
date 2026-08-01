import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.addColumn('profiles', {
    screen_name: { type: 'citext' },
  });
  pgm.sql(`
    UPDATE profiles
    SET screen_name = replace(callsign, '-', '_')
    WHERE screen_name IS NULL
  `);
  pgm.alterColumn('profiles', 'screen_name', { notNull: true });
  pgm.addConstraint('profiles', 'profiles_screen_name_format', {
    check: "screen_name ~ '^[A-Za-z0-9_]{3,24}$'",
  });
  pgm.createIndex('profiles', 'screen_name', {
    name: 'profiles_screen_name_unique',
    unique: true,
  });

  pgm.createType('friend_request_status', ['pending', 'accepted', 'declined']);
  pgm.createTable('friend_requests', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    requester_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    recipient_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'friend_request_status',
      notNull: true,
      default: 'pending',
    },
    responded_at: { type: 'timestamp with time zone' },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('friend_requests', 'friend_requests_distinct_users', {
    check: 'requester_user_id <> recipient_user_id',
  });
  pgm.sql(`
    CREATE UNIQUE INDEX friend_requests_one_pending_pair
    ON friend_requests (
      LEAST(requester_user_id, recipient_user_id),
      GREATEST(requester_user_id, recipient_user_id)
    )
    WHERE status = 'pending'
  `);
  pgm.createIndex('friend_requests', ['recipient_user_id', 'status']);
  pgm.createIndex('friend_requests', ['requester_user_id', 'status']);

  pgm.createTable('friendships', {
    user_a_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    user_b_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: timestamp,
  });
  pgm.addConstraint('friendships', 'friendships_pk', {
    primaryKey: ['user_a_id', 'user_b_id'],
  });
  pgm.addConstraint('friendships', 'friendships_canonical_pair', {
    check: 'user_a_id < user_b_id',
  });
  pgm.createIndex('friendships', 'user_b_id');

  pgm.createType('social_challenge_status', ['active', 'archived']);
  pgm.createTable('social_challenges', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    owner_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(80)', notNull: true },
    status: {
      type: 'social_challenge_status',
      notNull: true,
      default: 'active',
    },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('social_challenges', 'social_challenges_name_valid', {
    check: 'length(trim(name)) BETWEEN 1 AND 80',
  });
  pgm.createIndex('social_challenges', ['owner_user_id', 'created_at']);

  pgm.createType('social_challenge_member_role', ['owner', 'member']);
  pgm.createType('social_challenge_member_status', [
    'pending',
    'accepted',
    'declined',
  ]);
  pgm.createTable('social_challenge_members', {
    challenge_id: {
      type: 'uuid',
      notNull: true,
      references: 'social_challenges',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'social_challenge_member_role',
      notNull: true,
      default: 'member',
    },
    status: {
      type: 'social_challenge_member_status',
      notNull: true,
      default: 'pending',
    },
    invited_by_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    responded_at: { type: 'timestamp with time zone' },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('social_challenge_members', 'social_challenge_members_pk', {
    primaryKey: ['challenge_id', 'user_id'],
  });
  pgm.addConstraint(
    'social_challenge_members',
    'social_challenge_owner_accepted',
    { check: "role <> 'owner' OR status = 'accepted'" },
  );
  pgm.createIndex('social_challenge_members', ['user_id', 'status']);
  pgm.createIndex('social_challenge_members', ['challenge_id', 'status']);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('social_challenge_members');
  pgm.dropType('social_challenge_member_status');
  pgm.dropType('social_challenge_member_role');
  pgm.dropTable('social_challenges');
  pgm.dropType('social_challenge_status');
  pgm.dropTable('friendships');
  pgm.dropTable('friend_requests');
  pgm.dropType('friend_request_status');
  pgm.dropIndex('profiles', 'screen_name', {
    ifExists: true,
    name: 'profiles_screen_name_unique',
  });
  pgm.dropConstraint('profiles', 'profiles_screen_name_format');
  pgm.dropColumn('profiles', 'screen_name');
}
