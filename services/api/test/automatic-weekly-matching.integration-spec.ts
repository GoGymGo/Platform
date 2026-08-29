import { DatabaseService } from '../src/database/database.service';
import { AutomaticWeeklyMatchingService } from '../src/modules/competitions/automatic-weekly-matching.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

describeWithDatabase('automatic Weekly Challenge matching', () => {
  jest.setTimeout(120_000);

  const competitionId = '40000000-0000-4000-8000-000000000001';
  const userIds = [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
  ] as const;
  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  const matching = new AutomaticWeeklyMatchingService();

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const client = await migrated.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO region_policies (
          id, code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          boundary_version, policy_version, boundary, valid_from
        ) VALUES (
          '20000000-0000-4000-8000-000000000001', 'matching-test', 'CA',
          'BC', 'Matching Test', 'CAD', 'America/Vancouver', ARRAY['en'],
          18, true, 'matching-v1', 'matching-v1',
          ST_GeogFromText(
            'SRID=4326;MULTIPOLYGON(((-124 48,-122 48,-122 50,-124 50,-124 48)))'
          ),
          '2026-01-01T00:00:00.000Z'
        );

        INSERT INTO users (id, firebase_uid, email, email_verified)
        VALUES
          ('10000000-0000-4000-8000-000000000001', 'match-user-1', 'one@example.test', true),
          ('10000000-0000-4000-8000-000000000002', 'match-user-2', 'two@example.test', true),
          ('10000000-0000-4000-8000-000000000003', 'match-user-3', 'three@example.test', true),
          ('10000000-0000-4000-8000-000000000004', 'match-user-4', 'four@example.test', true);
      `);
      await client.query(
        `
        INSERT INTO region_verifications (
          id, user_id, region_policy_id, method, status, evidence_metadata,
          policy_version, verified_at, expires_at
        )
        SELECT
          gen_random_uuid(), user_row.id,
          '20000000-0000-4000-8000-000000000001', 'device_location',
          'approved', '{}'::jsonb, 'matching-v1',
          '2026-08-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z'
        FROM users AS user_row
        WHERE user_row.id = ANY($1::uuid[]);
        `,
        [userIds],
      );
      await client.query(`
        INSERT INTO competitions (
          id, region_policy_id, month_key, name, status, rules_version, rules,
          minimum_entrants, registration_opens_at, registration_closes_at,
          starts_at, ends_at
        ) VALUES (
          '40000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001', '2026-08',
          'Automatic Matching Fixture', 'active', 'matching-rules-v1',
          '{}'::jsonb, 100, '2026-07-01T00:00:00.000Z',
          '2026-07-31T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
          '2026-09-01T00:00:00.000Z'
        );

        INSERT INTO competition_goal_brackets (competition_id, goal_days, label)
        VALUES
          ('40000000-0000-4000-8000-000000000001', 1, 'One day'),
          ('40000000-0000-4000-8000-000000000001', 2, 'Two days');
      `);
      await client.query(
        `
        INSERT INTO competition_rule_acceptances (
          id, competition_id, user_id, rules_version,
          age_eligibility_attested, accepted_at
        )
        SELECT gen_random_uuid(),
          '40000000-0000-4000-8000-000000000001', user_row.id,
          'matching-rules-v1', true, '2026-07-25T00:00:00.000Z'
        FROM users AS user_row
        WHERE user_row.id = ANY($1::uuid[]);
        `,
        [userIds],
      );
      await client.query(
        `
        INSERT INTO competition_enrollments (
          competition_id, user_id, goal_days, region_verification_id,
          rules_acceptance_id, status, enrolled_at
        )
        SELECT
          '40000000-0000-4000-8000-000000000001', user_row.id,
          CASE WHEN user_row.id IN ($2::uuid, $3::uuid) THEN 1 ELSE 2 END,
          verification.id, acceptance.id, 'active',
          '2026-07-25T00:00:00.000Z'
        FROM users AS user_row
        INNER JOIN region_verifications AS verification
          ON verification.user_id = user_row.id
        INNER JOIN competition_rule_acceptances AS acceptance
          ON acceptance.user_id = user_row.id
         AND acceptance.competition_id =
             '40000000-0000-4000-8000-000000000001'
        WHERE user_row.id = ANY($1::uuid[]);
        `,
        [userIds, userIds[0], userIds[1]],
      );
      await client.query(
        `
        INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
        VALUES ($1::uuid, $2::uuid);
        `,
        [userIds[2], userIds[3]],
      );
      await client.query(
        `
        INSERT INTO friendships (user_a_id, user_b_id, created_at)
        VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid),
                '2026-07-26T00:00:00.000Z');
        `,
        [userIds[0], userIds[1]],
      );
      await client.query(
        `
        INSERT INTO weekly_challenge_requests (
          competition_id, period_index, requester_user_id, recipient_user_id,
          goal_days, status, created_at
        ) VALUES (
          $3::uuid, 4, $1::uuid, $2::uuid, 1, 'pending',
          '2026-08-27T18:00:00.000Z'
        );
        `,
        [userIds[0], userIds[1], competitionId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('pairs same-goal players immediately despite a pending invite and never pairs blocked players', async () => {
    const now = new Date('2026-08-27T19:00:00.000Z');
    for (const [index, userId] of userIds.entries()) {
      await database.connection.transaction().execute((transaction) =>
        matching.synchronize(transaction, {
          competitionId,
          goalDays: index < 2 ? 1 : 2,
          monthKey: '2026-08',
          now,
          timezone: 'America/Vancouver',
          userId,
        }),
      );
    }

    const matches = await migrated.pool.query<{
      goal_days: number;
      status: string;
      user_a_id: string;
      user_b_id: string | null;
    }>(
      `SELECT enrollment.goal_days, match.status::text, match.user_a_id,
              match.user_b_id
       FROM competition_matches AS match
       INNER JOIN competition_enrollments AS enrollment
         ON enrollment.competition_id = match.competition_id
        AND enrollment.user_id = match.user_a_id
       WHERE match.competition_id = $1 AND match.period_index = 4
         AND match.status <> 'cancelled'
       ORDER BY enrollment.goal_days, match.user_a_id`,
      [competitionId],
    );
    expect(matches.rows).toEqual([
      expect.objectContaining({
        goal_days: 1,
        status: 'matched',
        user_b_id: userIds[1],
      }),
      expect.objectContaining({ goal_days: 2, status: 'searching' }),
      expect.objectContaining({ goal_days: 2, status: 'searching' }),
    ]);
    const activeParticipants = await migrated.pool.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM competition_match_participants AS participant
       INNER JOIN competition_matches AS match ON match.id = participant.match_id
       WHERE match.competition_id = $1 AND match.status = 'matched'
         AND participant.active`,
      [competitionId],
    );
    expect(activeParticipants.rows[0]?.count).toBe(2);
    const pendingRequest = await migrated.pool.query<{
      cancellation_reason: string | null;
      status: string;
    }>(
      `SELECT cancellation_reason, status::text
       FROM weekly_challenge_requests
       WHERE competition_id = $1 AND period_index = 4`,
      [competitionId],
    );
    expect(pendingRequest.rows).toEqual([
      {
        cancellation_reason: 'automatic_match_created',
        status: 'cancelled',
      },
    ]);
  });
});
