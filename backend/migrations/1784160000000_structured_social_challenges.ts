import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createType('social_challenge_type', ['friend', 'regional']);
  pgm.createType('social_challenge_activity', [
    'gym',
    'running',
    'walking',
    'cycling',
    'hiking',
    'fitness_class',
    'other',
  ]);
  pgm.createType('social_challenge_target_period', ['weekly', 'monthly']);
  pgm.createType('social_challenge_checkin_source', [
    'manual',
    'verified_workout',
  ]);

  pgm.addColumns('social_challenges', {
    challenge_type: {
      type: 'social_challenge_type',
      notNull: true,
      default: 'friend',
    },
    activity: {
      type: 'social_challenge_activity',
      notNull: true,
      default: 'gym',
    },
    activity_label: {
      type: 'varchar(60)',
      notNull: true,
      default: 'Gym visits',
    },
    description: { type: 'varchar(240)' },
    target_count: { type: 'smallint', notNull: true, default: 4 },
    target_period: {
      type: 'social_challenge_target_period',
      notNull: true,
      default: 'weekly',
    },
    start_date: {
      type: 'date',
      notNull: true,
      default: pgm.func("date_trunc('month', current_date)::date"),
    },
    end_date: {
      type: 'date',
      notNull: true,
      default: pgm.func(
        "(date_trunc('month', current_date) + interval '1 month - 1 day')::date",
      ),
    },
    region_policy_id: {
      type: 'uuid',
      references: 'region_policies',
      onDelete: 'RESTRICT',
    },
    location_name: { type: 'varchar(120)' },
    scheduled_days: {
      type: 'smallint[]',
      notNull: true,
      default: pgm.func('ARRAY[]::smallint[]'),
    },
    scheduled_time_local: { type: 'time without time zone' },
    participant_limit: { type: 'smallint' },
  });

  pgm.addConstraint('social_challenges', 'social_challenges_dates_valid', {
    check: 'start_date <= end_date',
  });
  pgm.addConstraint('social_challenges', 'social_challenges_target_valid', {
    check: 'target_count BETWEEN 1 AND 31',
  });
  pgm.addConstraint('social_challenges', 'social_challenges_capacity_valid', {
    check: 'participant_limit IS NULL OR participant_limit BETWEEN 2 AND 500',
  });
  pgm.addConstraint('social_challenges', 'social_challenges_schedule_valid', {
    check: 'scheduled_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]',
  });
  pgm.addConstraint('social_challenges', 'social_challenges_region_valid', {
    check:
      "(challenge_type = 'regional' AND region_policy_id IS NOT NULL) OR " +
      "(challenge_type = 'friend' AND region_policy_id IS NULL)",
  });
  pgm.createIndex('social_challenges', [
    'challenge_type',
    'region_policy_id',
    'status',
    'start_date',
  ]);

  pgm.createTable('social_challenge_checkins', {
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
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    eligible_date: { type: 'date', notNull: true },
    source: {
      type: 'social_challenge_checkin_source',
      notNull: true,
      default: 'manual',
    },
    workout_session_id: {
      type: 'uuid',
      references: 'workout_sessions',
      onDelete: 'SET NULL',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'social_challenge_checkins',
    'social_challenge_checkins_unique_day',
    { unique: ['challenge_id', 'user_id', 'eligible_date'] },
  );
  pgm.createIndex('social_challenge_checkins', [
    'challenge_id',
    'user_id',
    'eligible_date',
  ]);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('social_challenge_checkins');
  pgm.dropColumns('social_challenges', [
    'challenge_type',
    'activity',
    'activity_label',
    'description',
    'target_count',
    'target_period',
    'start_date',
    'end_date',
    'region_policy_id',
    'location_name',
    'scheduled_days',
    'scheduled_time_local',
    'participant_limit',
  ]);
  pgm.dropType('social_challenge_checkin_source');
  pgm.dropType('social_challenge_target_period');
  pgm.dropType('social_challenge_activity');
  pgm.dropType('social_challenge_type');
}
