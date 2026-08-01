import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;
  pgm.createType('challenge_contact_invitation_channel', ['email', 'phone']);
  pgm.createType('challenge_contact_invitation_status', [
    'pending',
    'claimed',
    'revoked',
    'expired',
  ]);
  pgm.createTable('challenge_contact_invitations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    challenge_id: {
      type: 'uuid',
      notNull: true,
      references: 'social_challenges',
      onDelete: 'CASCADE',
    },
    inviter_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    channel: { type: 'challenge_contact_invitation_channel', notNull: true },
    destination_hash: { type: 'varchar(64)', notNull: true },
    destination_hint: { type: 'varchar(80)', notNull: true },
    invite_token_hash: { type: 'varchar(64)', notNull: true, unique: true },
    status: {
      type: 'challenge_contact_invitation_status',
      notNull: true,
      default: 'pending',
    },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    claimed_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL',
    },
    created_at: timestamp,
    claimed_at: { type: 'timestamp with time zone' },
  });
  pgm.createIndex('challenge_contact_invitations', ['challenge_id', 'status']);
  pgm.createIndex('challenge_contact_invitations', [
    'destination_hash',
    'status',
  ]);

  pgm.createType('weekly_challenge_request_status', [
    'pending',
    'accepted',
    'declined',
    'cancelled',
  ]);
  pgm.createTable('weekly_challenge_requests', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'CASCADE',
    },
    period_index: { type: 'smallint', notNull: true },
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
    goal_days: { type: 'smallint', notNull: true },
    status: {
      type: 'weekly_challenge_request_status',
      notNull: true,
      default: 'pending',
    },
    created_at: timestamp,
    responded_at: { type: 'timestamp with time zone' },
  });
  pgm.addConstraint(
    'weekly_challenge_requests',
    'weekly_challenge_request_range',
    {
      check: 'period_index BETWEEN 1 AND 4 AND goal_days BETWEEN 1 AND 7',
    },
  );
  pgm.addConstraint(
    'weekly_challenge_requests',
    'weekly_challenge_request_distinct_users',
    {
      check: 'requester_user_id <> recipient_user_id',
    },
  );
  pgm.sql(`
    CREATE UNIQUE INDEX weekly_challenge_requests_one_pending_pair
      ON weekly_challenge_requests (
        competition_id,
        period_index,
        LEAST(requester_user_id, recipient_user_id),
        GREATEST(requester_user_id, recipient_user_id)
      )
      WHERE status = 'pending'
  `);
  pgm.createIndex('weekly_challenge_requests', ['recipient_user_id', 'status']);

  pgm.createType('creator_video_submission_status', [
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'withdrawn',
  ]);
  pgm.createTable('creator_video_submissions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(100)', notNull: true },
    video_url: { type: 'text', notNull: true },
    thumbnail_url: { type: 'text' },
    duration_minutes: { type: 'smallint', notNull: true },
    workout_style: { type: 'varchar(80)', notNull: true },
    region_code: { type: 'varchar(64)', notNull: true },
    sponsor_disclosure: { type: 'text' },
    synthetic_media_disclosed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    rights_version: { type: 'varchar(40)', notNull: true },
    rights_accepted_at: timestamp,
    notes: { type: 'text' },
    status: {
      type: 'creator_video_submission_status',
      notNull: true,
      default: 'submitted',
    },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint(
    'creator_video_submissions',
    'creator_video_duration_range',
    {
      check: 'duration_minutes BETWEEN 5 AND 180',
    },
  );
  pgm.createIndex('creator_video_submissions', ['user_id', 'created_at']);
  pgm.createIndex('creator_video_submissions', ['status', 'created_at']);

  pgm.createTable('creator_workout_plans', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    creator_workout_id: {
      type: 'uuid',
      notNull: true,
      references: 'creator_workouts',
      onDelete: 'CASCADE',
    },
    planned_date: { type: 'date', notNull: true },
    note: { type: 'varchar(240)' },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('creator_workout_plans', 'creator_workout_plans_unique', {
    unique: ['user_id', 'creator_workout_id', 'planned_date'],
  });
  pgm.createIndex('creator_workout_plans', ['user_id', 'planned_date']);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('creator_workout_plans');
  pgm.dropTable('creator_video_submissions');
  pgm.dropType('creator_video_submission_status');
  pgm.dropTable('weekly_challenge_requests');
  pgm.dropType('weekly_challenge_request_status');
  pgm.dropTable('challenge_contact_invitations');
  pgm.dropType('challenge_contact_invitation_status');
  pgm.dropType('challenge_contact_invitation_channel');
}
