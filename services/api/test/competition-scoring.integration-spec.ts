import { DatabaseService } from '../src/database/database.service';
import { CompetitionLifecycleService } from '../src/modules/competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../src/modules/competitions/competition-scoring.service';
import { DrawsService } from '../src/modules/draws/draws.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { LeaderboardsService } from '../src/modules/leaderboards/leaderboards.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { RewardsService } from '../src/modules/rewards/rewards.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const rules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 2,
  minSessionMinutes: 10,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: true,
  requirePresenceCheck: true,
  requireGymQr: true,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

describeWithDatabase('authoritative competition scoring settlement', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let scoring: CompetitionScoringService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    scoring = new CompetitionScoringService(database, new LedgerService());
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('settles weekly, category, Bonus Day and Perfect Month entries exactly once', async () => {
    const region = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          boundary_version, policy_version, boundary, valid_from)
       VALUES
         ('scoring-bc', 'CA', 'BC', 'Scoring Test', 'CAD',
          'America/Vancouver', ARRAY['en-CA'], 18, TRUE,
          'boundary-v1', 'policy-v1',
          ST_GeogFromText(
            'SRID=4326;MULTIPOLYGON(((-123.5 49.0,-122.8 49.0,-122.8 49.6,-123.5 49.6,-123.5 49.0)))'
          ),
          '2026-01-01')
       RETURNING id`,
    );
    const competition = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, status, rules_version, rules,
          minimum_entrants, registration_opens_at, registration_closes_at,
          starts_at, ends_at)
       VALUES
         ($1, '2026-07', 'Scoring Integration', 'registration', 'rules-v1',
          $2::jsonb, 2, '2026-06-01', '2026-07-01',
          '2026-07-01', '2026-08-01')
       RETURNING id`,
      [region.rows[0].id, JSON.stringify(rules)],
    );
    const competitionId = competition.rows[0].id;
    await migrated.pool.query(
      `INSERT INTO competition_goal_brackets
         (competition_id, goal_days, label)
       VALUES ($1, 3, 'Three days')`,
      [competitionId],
    );

    const users = await migrated.pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid, email, email_verified)
       VALUES
         ('scoring-user-a', 'scoring-a@integration.test', TRUE),
         ('scoring-user-b', 'scoring-b@integration.test', TRUE)
       RETURNING id`,
    );
    const [userAId, userBId] = users.rows.map(({ id }) => id);
    await migrated.pool.query(
      `INSERT INTO profiles (user_id, callsign, screen_name)
       VALUES ($1, 'SCORING_ALPHA', 'SCORING_ALPHA'),
              ($2, 'SCORING_BRAVO', 'SCORING_BRAVO')`,
      [userAId, userBId],
    );
    const verifications = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `INSERT INTO region_verifications
         (user_id, region_policy_id, method, status, evidence_metadata,
          policy_version, verified_at, expires_at)
       VALUES
         ($1, $3, 'device_location', 'approved', '{}'::jsonb, 'policy-v1', '2026-06-01', '2026-08-01'),
         ($2, $3, 'device_location', 'approved', '{}'::jsonb, 'policy-v1', '2026-06-01', '2026-08-01')
       RETURNING id, user_id`,
      [userAId, userBId, region.rows[0].id],
    );
    const acceptances = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `INSERT INTO competition_rule_acceptances
         (competition_id, user_id, rules_version, age_eligibility_attested,
          accepted_at)
       VALUES
         ($1, $2, 'rules-v1', TRUE, '2026-06-01'),
         ($1, $3, 'rules-v1', TRUE, '2026-06-01')
       RETURNING id, user_id`,
      [competitionId, userAId, userBId],
    );
    const verificationByUser = new Map(
      verifications.rows.map((row) => [row.user_id, row.id]),
    );
    const acceptanceByUser = new Map(
      acceptances.rows.map((row) => [row.user_id, row.id]),
    );
    const enrollments = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `INSERT INTO competition_enrollments
         (competition_id, user_id, goal_days, region_verification_id,
          rules_acceptance_id, status, enrolled_at)
       VALUES
         ($1, $2, 3, $4, $6, 'active', '2026-07-01'),
         ($1, $3, 3, $5, $7, 'active', '2026-07-01')
       RETURNING id, user_id`,
      [
        competitionId,
        userAId,
        userBId,
        verificationByUser.get(userAId),
        verificationByUser.get(userBId),
        acceptanceByUser.get(userAId),
        acceptanceByUser.get(userBId),
      ],
    );
    const enrollmentByUser = new Map(
      enrollments.rows.map((row) => [row.user_id, row.id]),
    );
    const lifecycle = new CompetitionLifecycleService(
      database,
      {} as NotificationsService,
    );
    await expect(lifecycle.processDueStarts()).resolves.toEqual({
      activated: 1,
      cancelled: 0,
    });
    const [friendAId, friendBId] = [userAId, userBId].sort();
    await migrated.pool.query(
      `INSERT INTO friendships (user_a_id, user_b_id)
       VALUES ($1, $2)`,
      [friendAId, friendBId],
    );
    await migrated.pool.query(
      `WITH accepted_requests AS (
         INSERT INTO weekly_challenge_requests
           (competition_id, period_index, requester_user_id,
            recipient_user_id, goal_days, status, created_at, responded_at,
            accepted_at)
         SELECT $1, period_index, $2, $3, 3, 'accepted',
                accepted_at - interval '1 hour', accepted_at, accepted_at
         FROM (VALUES
           (1, '2026-07-01 12:00:00+00'::timestamptz),
           (2, '2026-07-08 12:00:00+00'::timestamptz),
           (3, '2026-07-15 12:00:00+00'::timestamptz),
           (4, '2026-07-22 12:00:00+00'::timestamptz)
         ) AS periods(period_index, accepted_at)
         RETURNING id, period_index, accepted_at
       )
       INSERT INTO competition_matches
         (competition_id, period_index, period_start_date, period_end_date,
          user_a_id, user_b_id, status, created_at,
          weekly_challenge_request_id)
       SELECT $1, request.period_index,
              CASE request.period_index
                WHEN 1 THEN '2026-07-01'::date
                WHEN 2 THEN '2026-07-08'::date
                WHEN 3 THEN '2026-07-15'::date
                ELSE '2026-07-22'::date
              END,
              CASE request.period_index
                WHEN 1 THEN '2026-07-07'::date
                WHEN 2 THEN '2026-07-14'::date
                WHEN 3 THEN '2026-07-21'::date
                ELSE '2026-07-28'::date
              END,
              LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid),
              'matched', request.accepted_at, request.id
       FROM accepted_requests AS request`,
      [competitionId, userAId, userBId],
    );

    const userADates = [
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-29',
      '2026-07-30',
    ];
    const userBDates = [
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ];

    const sessionRows = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, completed_at)
       SELECT $1::uuid, $2::uuid, $3::uuid, date_key::date,
              'verified'::workout_session_status, 'rules-v1',
              date_key::date + time '12:00', date_key::date + time '12:30'
       FROM unnest($4::text[]) AS date_key
       UNION ALL
       SELECT $1::uuid, $5::uuid, $6::uuid, date_key::date,
              'verified'::workout_session_status, 'rules-v1',
              date_key::date + time '12:00', date_key::date + time '12:30'
       FROM unnest($7::text[]) AS date_key
       RETURNING id, user_id`,
      [
        competitionId,
        enrollmentByUser.get(userAId),
        userAId,
        userADates,
        enrollmentByUser.get(userBId),
        userBId,
        userBDates,
      ],
    );
    await migrated.pool.query(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, completed_at)
       VALUES
         ($1, $2, $3, '2026-07-05', 'cancelled', 'rules-v1',
          '2026-07-05 12:00:00+00', '2026-07-05 12:10:00+00'),
         ($1, $2, $3, '2026-07-06', 'rejected', 'rules-v1',
          '2026-07-06 12:00:00+00', '2026-07-06 12:10:00+00'),
         ($1, $2, $3, '2026-07-07', 'pending_review', 'rules-v1',
          '2026-07-07 12:00:00+00', '2026-07-07 12:10:00+00')`,
      [competitionId, enrollmentByUser.get(userAId), userAId],
    );
    await expect(
      migrated.pool.query(
        `INSERT INTO workout_sessions
           (competition_id, enrollment_id, user_id, eligible_date, status,
            policy_version, started_at, completed_at)
         VALUES ($1, $2, $3, '2026-07-01', 'verified', 'rules-v1',
                 '2026-07-01 18:00:00+00', '2026-07-01 18:30:00+00')`,
        [competitionId, enrollmentByUser.get(userAId), userAId],
      ),
    ).rejects.toThrow();
    await expect(
      migrated.pool.query(
        `INSERT INTO workout_sessions
           (competition_id, enrollment_id, user_id, eligible_date, status,
            policy_version, started_at, completed_at)
         VALUES ($1, $2, $3, '2026-07-12', 'verified', 'rules-v1',
                 '2026-07-12 18:00:00+00', '2026-07-12 18:30:00+00')`,
        [competitionId, enrollmentByUser.get(userBId), userAId],
      ),
    ).rejects.toThrow(/exact active enrollment|foreign key/i);
    await expect(
      migrated.pool.query(
        `INSERT INTO workout_sessions
           (competition_id, enrollment_id, user_id, eligible_date, status,
            policy_version, started_at, completed_at)
         VALUES ($1, $2, $3, '2026-08-01', 'verified', 'rules-v1',
                 '2026-08-01 18:00:00+00', '2026-08-01 18:30:00+00')`,
        [competitionId, enrollmentByUser.get(userAId), userAId],
      ),
    ).rejects.toThrow(/regional calendar day/i);
    const ledger = new LedgerService();
    await database.connection.transaction().execute(async (transaction) => {
      for (const [userId, enrollmentId] of enrollmentByUser) {
        await ledger.append(transaction, {
          categoryScoreDelta: 0,
          competitionId,
          enrollmentId,
          goalDays: 3,
          policyVersion: 'rules-v1',
          prizeDrawEntriesDelta: rules.signupPrizeDrawEntries,
          reason: 'enrollment',
          sourceEventId: enrollmentId,
          userId,
          verifiedDaysDelta: 0,
        });
      }
      for (const session of sessionRows.rows) {
        await ledger.append(transaction, {
          categoryScoreDelta: rules.verifiedSessionCategoryScore,
          competitionId,
          enrollmentId: enrollmentByUser.get(session.user_id)!,
          goalDays: 3,
          policyVersion: 'rules-v1',
          prizeDrawEntriesDelta: rules.verifiedSessionPrizeDrawEntries,
          reason: 'verified_session',
          sourceEventId: session.id,
          userId: session.user_id,
          verifiedDaysDelta: 1,
        });
      }
    });

    const liveReadTime = new Date('2026-07-20T12:00:00.000Z');
    const leaderboards = new LeaderboardsService(
      database,
      new ProfilesService(database),
    );
    const userAPrincipal = {
      email: 'scoring-a@integration.test',
      emailVerified: true,
      firebaseUid: 'scoring-user-a',
      roles: [],
      signInProvider: 'password',
      tokenIssuedAt: 1,
    };
    const liveLeaderboard = await leaderboards.getCurrentLeaderboard(
      userAPrincipal,
      3,
      liveReadTime,
    );
    expect(liveLeaderboard).toMatchObject({
      competitionId,
      goal: 3,
      rulesVersion: 'rules-v1',
      scoringStatus: 'provisional',
      settledPeriodCount: 0,
    });
    expect(liveLeaderboard?.rows).toEqual([
      {
        alias: 'SCORING_ALPHA',
        categoryEntries: 15,
        isCurrentUser: true,
        rank: 1,
        streaks: expect.any(Object),
        verifiedDays: 15,
      },
      {
        alias: 'SCORING_BRAVO',
        categoryEntries: 12,
        isCurrentUser: false,
        rank: 2,
        streaks: expect.any(Object),
        verifiedDays: 12,
      },
    ]);
    expect(Object.keys(liveLeaderboard?.rows[0] ?? {}).sort()).toEqual([
      'alias',
      'categoryEntries',
      'isCurrentUser',
      'rank',
      'streaks',
      'verifiedDays',
    ]);
    await expect(
      leaderboards.getMyProgress(userAPrincipal, liveReadTime),
    ).resolves.toMatchObject({
      bankedPrizeDrawEntries: 1,
      categoryScore: 15,
      competitionId,
      competitionStatus: 'active',
      prizeDrawEntries: 1,
      projectedPrizeDrawEntries: 16,
      referenceDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      rulesVersion: 'rules-v1',
      scoringStatus: 'provisional',
      settledPeriodCount: 0,
      verifiedDays: 15,
    });
    const settle = () =>
      database.connection
        .transaction()
        .execute((transaction) =>
          scoring.finalizeForDraw(
            transaction,
            competitionId,
            new Date('2026-08-01T12:00:00.000Z'),
          ),
        );
    const firstSettlement = await settle();
    expect(firstSettlement.reconciledProgressRows).toBe(0);
    expect(firstSettlement.settlementInputs).toHaveLength(2);
    expect(
      new Map(
        firstSettlement.settlementInputs.map((input) => [
          input.userId,
          {
            categoryRank: input.categoryRank,
            goalDays: input.goalDays,
            rulesVersion: input.rulesVersion,
            verifiedDays: input.verifiedDays,
          },
        ]),
      ),
    ).toEqual(
      new Map([
        [
          userAId,
          {
            categoryRank: 1,
            goalDays: 3,
            rulesVersion: 'rules-v1',
            verifiedDays: 15,
          },
        ],
        [
          userBId,
          {
            categoryRank: 2,
            goalDays: 3,
            rulesVersion: 'rules-v1',
            verifiedDays: 12,
          },
        ],
      ]),
    );

    await migrated.pool.query(
      `UPDATE competition_progress
       SET category_score = 0, prize_draw_entries = 1, verified_days = 0
       WHERE competition_id = $1 AND user_id = $2`,
      [competitionId, userAId],
    );
    const replayedSettlement = await settle();
    expect(replayedSettlement.reconciledProgressRows).toBe(1);
    expect(replayedSettlement.settlementInputs).toEqual(
      firstSettlement.settlementInputs,
    );

    const progress = await migrated.pool.query<{
      category_score: number;
      prize_draw_entries: number;
      user_id: string;
    }>(
      `SELECT user_id, category_score, prize_draw_entries
       FROM competition_progress
       WHERE competition_id = $1
       ORDER BY user_id`,
      [competitionId],
    );
    expect(
      new Map(
        progress.rows.map((row) => [
          row.user_id,
          {
            categoryScore: Number(row.category_score),
            prizeDrawEntries: Number(row.prize_draw_entries),
          },
        ]),
      ),
    ).toEqual(
      new Map([
        [userAId, { categoryScore: 24, prizeDrawEntries: 781 }],
        [userBId, { categoryScore: 24, prizeDrawEntries: 481 }],
      ]),
    );

    const ledgerReasons = await migrated.pool.query<{
      count: string;
      reason: string;
    }>(
      `SELECT reason::text, count(*)::text
       FROM entry_ledger
       WHERE competition_id = $1
       GROUP BY reason
       ORDER BY reason`,
      [competitionId],
    );
    expect(
      Object.fromEntries(
        ledgerReasons.rows.map((row) => [row.reason, Number(row.count)]),
      ),
    ).toMatchObject({
      bonus_day: 1,
      category_placement: 2,
      enrollment: 2,
      perfect_month: 2,
      verified_session: userADates.length + userBDates.length,
      weekly_match: 8,
    });

    const matches = await migrated.pool.query<{
      count: string;
      paired: string;
      periods: string;
      settled: string;
    }>(
      `SELECT count(*)::text,
              count(*) FILTER (WHERE user_b_id IS NOT NULL)::text AS paired,
              count(DISTINCT period_index)::text AS periods,
              count(*) FILTER (WHERE status = 'settled')::text AS settled
       FROM competition_matches
       WHERE competition_id = $1`,
      [competitionId],
    );
    expect(matches.rows[0]).toEqual({
      count: '4',
      paired: '4',
      periods: '4',
      settled: '4',
    });

    await migrated.pool.query(
      `UPDATE workout_sessions
       SET status = 'rejected'
       WHERE competition_id = $1 AND status = 'pending_review'`,
      [competitionId],
    );
    const draws = new DrawsService(
      database,
      {} as NotificationsService,
      {} as RewardsService,
      scoring,
    );
    const lockInput = {
      competitionId,
      operatorUserId: userAId,
      reason: 'Integration settlement-input verification',
      requestId: 'scoring-integration-lock',
      seedCommitment: 'a'.repeat(64),
    };
    const lockedDraw = await draws.lock(lockInput);
    expect(lockedDraw).toMatchObject({
      entrantCount: 2,
      entrantSnapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      scoringSnapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      totalEntries: '1262',
    });
    await expect(draws.lock(lockInput)).resolves.toEqual(lockedDraw);

    const storedSnapshot = await migrated.pool.query<{
      draw_id: string;
      rows: string;
      snapshot_positions: number[];
    }>(
      `SELECT draw_id, count(*)::text AS rows,
              array_agg(snapshot_position ORDER BY snapshot_position) AS snapshot_positions
       FROM competition_settlement_inputs
       WHERE competition_id = $1
       GROUP BY draw_id`,
      [competitionId],
    );
    expect(storedSnapshot.rows).toEqual([
      {
        draw_id: lockedDraw.drawId,
        rows: '2',
        snapshot_positions: [1, 2],
      },
    ]);
    const storedDrawEntries = await migrated.pool.query<{
      entry_count: string;
      snapshot_position: number;
      user_id: string;
    }>(
      `SELECT user_id, entry_count::text, snapshot_position
       FROM draw_entries
       WHERE draw_id = $1
       ORDER BY snapshot_position`,
      [lockedDraw.drawId],
    );
    expect(storedDrawEntries.rows).toEqual(
      firstSettlement.settlementInputs.map((input, index) => ({
        entry_count: String(input.prizeDrawEntries),
        snapshot_position: index + 1,
        user_id: input.userId,
      })),
    );
  });
});
