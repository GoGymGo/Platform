import {
  BC_DEMO_REGION_CODE,
  bootstrapBcDemoFoundation,
  bootstrapBcDemoOperator,
} from '../src/foundation/bc-demo-foundation';
import {
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

describeWithDatabase('BC brand-reward foundation', () => {
  jest.setTimeout(120_000);

  let migrated: MigratedPostgisTestDatabase;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
  });

  afterAll(async () => {
    await migrated?.stop();
  });

  it('seeds an idempotent region contest and physical reward without payment tables', async () => {
    const first = await bootstrapBcDemoFoundation(
      migrated.pool,
      '2026-08',
      'Integration test for the BC brand-reward foundation.',
    );
    const retry = await bootstrapBcDemoFoundation(
      migrated.pool,
      '2026-08',
      'Integration test for the BC brand-reward foundation.',
    );

    expect(first).toMatchObject({
      competitionCreated: true,
      competitionStatus: 'registration',
      monthKey: '2026-08',
      regionCreated: true,
      rewardCreated: true,
      safety: { brandRewardsOnly: true, competitionEnabled: true },
    });
    expect(retry).toEqual({
      ...first,
      competitionCreated: false,
      regionCreated: false,
      rewardCreated: false,
    });

    const catalog = await migrated.pool.query<{
      code: string;
      reward_type: string;
      status: string;
      title: string;
    }>(
      `SELECT region.code, reward.reward_type, reward.status, reward.title
       FROM reward_catalog_items AS reward
       JOIN competitions AS competition ON competition.id = reward.competition_id
       JOIN region_policies AS region ON region.id = competition.region_policy_id
       WHERE reward.id = $1`,
      [first.rewardId],
    );
    expect(catalog.rows[0]).toEqual({
      code: BC_DEMO_REGION_CODE,
      reward_type: 'physical',
      status: 'published',
      title: 'GoGymGo Starter Pack',
    });

    const removedTables = await migrated.pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'hyperwallet_users', 'payout_claims', 'payout_payments',
           'payout_release_control', 'provider_webhooks'
         )`,
    );
    expect(removedTables.rows).toEqual([]);

    const users = await migrated.pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid, email_verified, roles, status)
       SELECT 'reward-inventory-user-' || value, TRUE, ARRAY['user'], 'active'
       FROM generate_series(1, 26) AS value
       RETURNING id`,
    );
    const draw = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competition_draws
         (competition_id, status, rules_version, seed_commitment,
          entrant_snapshot_hash, entrant_count, total_entries)
       VALUES ($1, 'locked', 'bc-demo-foundation-v1', repeat('a', 64),
               repeat('b', 64), 26, 26)
       RETURNING id`,
      [first.competitionId],
    );
    await migrated.pool.query(
      `INSERT INTO reward_awards
         (draw_id, reward_catalog_item_id, user_id, award_rank, status)
       SELECT $1, $2, user_id, rank::integer, 'awarded'
       FROM unnest($3::uuid[]) WITH ORDINALITY AS selected(user_id, rank)`,
      [
        draw.rows[0].id,
        first.rewardId,
        users.rows.slice(0, 25).map((user) => user.id),
      ],
    );
    await expect(
      migrated.pool.query(
        `INSERT INTO reward_awards
           (draw_id, reward_catalog_item_id, user_id, award_rank, status)
         VALUES ($1, $2, $3, 26, 'awarded')`,
        [draw.rows[0].id, first.rewardId, users.rows[25].id],
      ),
    ).rejects.toThrow('reward inventory exhausted');
  });

  it('assigns the least-privilege operator role idempotently', async () => {
    await migrated.pool.query(
      `INSERT INTO users
         (firebase_uid, email, email_verified, roles, status)
       VALUES ('bc-brand-operator', 'operator@example.test', TRUE,
               ARRAY['admin', 'user'], 'active')`,
    );
    await expect(
      bootstrapBcDemoOperator(
        migrated.pool,
        'bc-brand-operator',
        'Assign local brand reward review access.',
      ),
    ).resolves.toEqual({ changed: true, roles: ['operator', 'user'] });
    await expect(
      bootstrapBcDemoOperator(
        migrated.pool,
        'bc-brand-operator',
        'Confirm local brand reward review access.',
      ),
    ).resolves.toEqual({ changed: false, roles: ['operator', 'user'] });
  });
});
