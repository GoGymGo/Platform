import { DatabaseService } from '../src/database/database.service';
import { CompetitionLifecycleService } from '../src/modules/competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../src/modules/competitions/competition-scoring.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
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
    const verifications = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `INSERT INTO region_verifications
         (user_id, region_policy_id, method, status, evidence_metadata,
          policy_version, verified_at)
       VALUES
         ($1, $3, 'manual_review', 'approved', '{}'::jsonb, 'policy-v1', '2026-06-01'),
         ($2, $3, 'manual_review', 'approved', '{}'::jsonb, 'policy-v1', '2026-06-01')
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
      scoring,
    );
    await expect(lifecycle.processDueStarts()).resolves.toEqual({
      activated: 1,
      cancelled: 0,
    });

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
    await settle();
    await settle();

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
  });
});
