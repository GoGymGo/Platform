import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createType('competition_status', [
    'draft',
    'registration',
    'active',
    'settling',
    'settled',
    'cancelled',
  ]);
  pgm.createType('enrollment_status', ['active', 'withdrawn', 'disqualified']);
  pgm.createType('competition_match_status', [
    'searching',
    'matched',
    'settled',
    'cancelled',
  ]);
  pgm.createType('workout_session_status', [
    'active',
    'pending_review',
    'verified',
    'rejected',
    'cancelled',
  ]);
  pgm.createType('session_event_type', [
    'heart_rate_sample',
    'face_check',
    'gym_qr_scan',
    'device_attestation',
  ]);
  pgm.createType('ledger_reason', [
    'enrollment',
    'verified_session',
    'weekly_match',
    'perfect_month',
    'reversal',
    'operator_adjustment',
  ]);
  pgm.createType('draw_status', ['locked', 'settled', 'cancelled']);

  pgm.createTable('competitions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    region_policy_id: {
      type: 'uuid',
      notNull: true,
      references: 'region_policies',
      onDelete: 'RESTRICT',
    },
    month_key: { type: 'char(7)', notNull: true },
    name: { type: 'varchar(160)', notNull: true },
    status: { type: 'competition_status', notNull: true, default: 'draft' },
    currency: { type: 'char(3)', notNull: true },
    rules_version: { type: 'varchar(64)', notNull: true },
    rules: { type: 'jsonb', notNull: true },
    minimum_entrants: { type: 'integer', notNull: true, default: 100 },
    entrant_cap: { type: 'integer' },
    registration_opens_at: { type: 'timestamp with time zone', notNull: true },
    registration_closes_at: { type: 'timestamp with time zone', notNull: true },
    starts_at: { type: 'timestamp with time zone', notNull: true },
    ends_at: { type: 'timestamp with time zone', notNull: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('competitions', 'competitions_region_month_unique', {
    unique: ['region_policy_id', 'month_key'],
  });
  pgm.addConstraint('competitions', 'competitions_month_key_format', {
    check: "month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'",
  });
  pgm.addConstraint('competitions', 'competitions_time_window', {
    check:
      'registration_opens_at < registration_closes_at AND registration_closes_at <= starts_at AND starts_at < ends_at',
  });
  pgm.addConstraint('competitions', 'competitions_entrant_limits', {
    check:
      'minimum_entrants >= 100 AND (entrant_cap IS NULL OR entrant_cap >= minimum_entrants)',
  });
  pgm.createIndex('competitions', ['status', 'starts_at', 'ends_at']);

  pgm.createTable('competition_goal_brackets', {
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'CASCADE',
    },
    goal_days: { type: 'smallint', notNull: true },
    label: { type: 'varchar(80)', notNull: true },
    created_at: timestamp,
  });
  pgm.addConstraint(
    'competition_goal_brackets',
    'competition_goal_brackets_pk',
    {
      primaryKey: ['competition_id', 'goal_days'],
    },
  );
  pgm.addConstraint(
    'competition_goal_brackets',
    'competition_goal_days_range',
    {
      check: 'goal_days BETWEEN 1 AND 7',
    },
  );

  pgm.createTable('competition_rule_acceptances', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    rules_version: { type: 'varchar(64)', notNull: true },
    age_eligibility_attested: { type: 'boolean', notNull: true },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    accepted_at: timestamp,
  });
  pgm.addConstraint(
    'competition_rule_acceptances',
    'competition_rule_acceptances_unique',
    {
      unique: ['competition_id', 'user_id', 'rules_version'],
    },
  );

  pgm.createTable('competition_enrollments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    goal_days: { type: 'smallint', notNull: true },
    region_verification_id: {
      type: 'uuid',
      notNull: true,
      references: 'region_verifications',
      onDelete: 'RESTRICT',
    },
    rules_acceptance_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_rule_acceptances',
      onDelete: 'RESTRICT',
    },
    status: { type: 'enrollment_status', notNull: true, default: 'active' },
    enrolled_at: timestamp,
  });
  pgm.addConstraint(
    'competition_enrollments',
    'competition_enrollments_user_unique',
    {
      unique: ['competition_id', 'user_id'],
    },
  );
  pgm.addConstraint(
    'competition_enrollments',
    'competition_enrollments_goal_fk',
    {
      foreignKeys: {
        columns: ['competition_id', 'goal_days'],
        references: 'competition_goal_brackets(competition_id, goal_days)',
        onDelete: 'RESTRICT',
      },
    },
  );
  pgm.createIndex('competition_enrollments', [
    'competition_id',
    'goal_days',
    'status',
  ]);

  pgm.createTable('competition_matches', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    period_index: { type: 'smallint', notNull: true },
    period_start_date: { type: 'date', notNull: true },
    period_end_date: { type: 'date', notNull: true },
    user_a_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    user_b_id: { type: 'uuid', references: 'users', onDelete: 'RESTRICT' },
    status: {
      type: 'competition_match_status',
      notNull: true,
      default: 'searching',
    },
    outcome: { type: 'jsonb' },
    created_at: timestamp,
    settled_at: { type: 'timestamp with time zone' },
  });
  pgm.addConstraint('competition_matches', 'competition_matches_period_range', {
    check:
      'period_index BETWEEN 1 AND 4 AND period_end_date >= period_start_date',
  });
  pgm.addConstraint(
    'competition_matches',
    'competition_matches_distinct_users',
    {
      check: 'user_b_id IS NULL OR user_b_id <> user_a_id',
    },
  );
  pgm.createIndex('competition_matches', [
    'competition_id',
    'period_index',
    'status',
  ]);
  pgm.sql(`
    CREATE UNIQUE INDEX competition_matches_user_a_period_unique
      ON competition_matches (competition_id, period_index, user_a_id);
    CREATE UNIQUE INDEX competition_matches_user_b_period_unique
      ON competition_matches (competition_id, period_index, user_b_id)
      WHERE user_b_id IS NOT NULL;
  `);

  pgm.createTable('workout_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
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
    eligible_date: { type: 'date', notNull: true },
    status: {
      type: 'workout_session_status',
      notNull: true,
      default: 'active',
    },
    policy_version: { type: 'varchar(64)', notNull: true },
    client_started_at: { type: 'timestamp with time zone' },
    started_at: { type: 'timestamp with time zone', notNull: true },
    completed_at: { type: 'timestamp with time zone' },
    verification_summary: { type: 'jsonb' },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.createIndex('workout_sessions', [
    'competition_id',
    'user_id',
    'eligible_date',
  ]);
  pgm.sql(`
    CREATE UNIQUE INDEX workout_sessions_one_active_per_user
      ON workout_sessions (user_id)
      WHERE status = 'active';
    CREATE UNIQUE INDEX workout_sessions_one_verified_day
      ON workout_sessions (competition_id, user_id, eligible_date)
      WHERE status = 'verified';
  `);

  pgm.createTable('session_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    session_id: {
      type: 'uuid',
      notNull: true,
      references: 'workout_sessions',
      onDelete: 'RESTRICT',
    },
    client_event_id: { type: 'uuid', notNull: true },
    event_type: { type: 'session_event_type', notNull: true },
    occurred_at: { type: 'timestamp with time zone', notNull: true },
    received_at: timestamp,
    payload: { type: 'jsonb', notNull: true },
  });
  pgm.addConstraint('session_events', 'session_events_client_unique', {
    unique: ['session_id', 'client_event_id'],
  });
  pgm.createIndex('session_events', [
    'session_id',
    'event_type',
    'occurred_at',
  ]);

  pgm.createTable('entry_ledger', {
    id: { type: 'bigserial', primaryKey: true },
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
    reason: { type: 'ledger_reason', notNull: true },
    source_event_id: { type: 'uuid', notNull: true },
    verified_days_delta: { type: 'integer', notNull: true, default: 0 },
    category_score_delta: { type: 'integer', notNull: true, default: 0 },
    prize_draw_entries_delta: { type: 'integer', notNull: true, default: 0 },
    policy_version: { type: 'varchar(64)', notNull: true },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: timestamp,
  });
  pgm.addConstraint('entry_ledger', 'entry_ledger_source_unique', {
    unique: ['competition_id', 'user_id', 'reason', 'source_event_id'],
  });
  pgm.addConstraint('entry_ledger', 'entry_ledger_nonzero_delta', {
    check:
      'verified_days_delta <> 0 OR category_score_delta <> 0 OR prize_draw_entries_delta <> 0',
  });
  pgm.createIndex('entry_ledger', ['competition_id', 'user_id', 'created_at']);

  pgm.createTable('competition_progress', {
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
    verified_days: { type: 'integer', notNull: true, default: 0 },
    category_score: { type: 'integer', notNull: true, default: 0 },
    prize_draw_entries: { type: 'integer', notNull: true, default: 0 },
    updated_at: timestamp,
  });
  pgm.addConstraint('competition_progress', 'competition_progress_pk', {
    primaryKey: ['competition_id', 'user_id'],
  });
  pgm.addConstraint(
    'competition_progress',
    'competition_progress_nonnegative',
    {
      check:
        'verified_days >= 0 AND category_score >= 0 AND prize_draw_entries >= 0',
    },
  );
  pgm.createIndex('competition_progress', [
    'competition_id',
    'goal_days',
    'category_score',
  ]);

  pgm.createTable('competition_draws', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    competition_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
    status: { type: 'draw_status', notNull: true, default: 'locked' },
    rules_version: { type: 'varchar(64)', notNull: true },
    seed_commitment: { type: 'char(64)', notNull: true },
    seed_reveal: { type: 'char(64)' },
    entrant_snapshot_hash: { type: 'char(64)', notNull: true },
    entrant_count: { type: 'integer', notNull: true },
    total_entries: { type: 'bigint', notNull: true },
    locked_at: timestamp,
    settled_at: { type: 'timestamp with time zone' },
  });

  pgm.createTable('draw_entries', {
    draw_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_draws',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    enrollment_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_enrollments',
      onDelete: 'RESTRICT',
    },
    entry_count: { type: 'integer', notNull: true },
    snapshot_position: { type: 'integer', notNull: true },
    created_at: timestamp,
  });
  pgm.addConstraint('draw_entries', 'draw_entries_pk', {
    primaryKey: ['draw_id', 'user_id'],
  });
  pgm.addConstraint('draw_entries', 'draw_entries_positive', {
    check: 'entry_count > 0 AND snapshot_position > 0',
  });

  pgm.createTable('draw_winners', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    draw_id: {
      type: 'uuid',
      notNull: true,
      references: 'competition_draws',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    payout_rank: { type: 'integer', notNull: true },
    amount_minor: { type: 'bigint', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    created_at: timestamp,
  });
  pgm.addConstraint('draw_winners', 'draw_winners_user_unique', {
    unique: ['draw_id', 'user_id'],
  });
  pgm.addConstraint('draw_winners', 'draw_winners_rank_unique', {
    unique: ['draw_id', 'payout_rank'],
  });
  pgm.addConstraint('draw_winners', 'draw_winners_positive', {
    check: 'payout_rank > 0 AND amount_minor > 0',
  });

  pgm.sql(`
    CREATE TRIGGER session_events_append_only
    BEFORE UPDATE OR DELETE ON session_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER entry_ledger_append_only
    BEFORE UPDATE OR DELETE ON entry_ledger
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER draw_entries_append_only
    BEFORE UPDATE OR DELETE ON draw_entries
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER draw_winners_append_only
    BEFORE UPDATE OR DELETE ON draw_winners
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP TRIGGER IF EXISTS draw_winners_append_only ON draw_winners;');
  pgm.sql('DROP TRIGGER IF EXISTS draw_entries_append_only ON draw_entries;');
  pgm.sql('DROP TRIGGER IF EXISTS entry_ledger_append_only ON entry_ledger;');
  pgm.sql(
    'DROP TRIGGER IF EXISTS session_events_append_only ON session_events;',
  );
  pgm.dropTable('draw_winners');
  pgm.dropTable('draw_entries');
  pgm.dropTable('competition_draws');
  pgm.dropTable('competition_progress');
  pgm.dropTable('entry_ledger');
  pgm.dropTable('session_events');
  pgm.dropTable('workout_sessions');
  pgm.dropTable('competition_matches');
  pgm.dropTable('competition_enrollments');
  pgm.dropTable('competition_rule_acceptances');
  pgm.dropTable('competition_goal_brackets');
  pgm.dropTable('competitions');
  pgm.dropType('draw_status');
  pgm.dropType('ledger_reason');
  pgm.dropType('session_event_type');
  pgm.dropType('workout_session_status');
  pgm.dropType('competition_match_status');
  pgm.dropType('enrollment_status');
  pgm.dropType('competition_status');
}
