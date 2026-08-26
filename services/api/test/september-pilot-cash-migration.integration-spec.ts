import {
  migrateTestDatabase,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const ids = {
  competition: '20000000-0000-4000-8000-000000000001',
  draw: '20000000-0000-4000-8000-000000000002',
  region: '20000000-0000-4000-8000-000000000003',
  reward: '20000000-0000-4000-8000-000000000004',
};

describeWithDatabase('September pilot cash migration', () => {
  jest.setTimeout(180_000);

  let migrated: MigratedPostgisTestDatabase;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase('1787446800000');

    await migrated.pool.query(
      `INSERT INTO region_policies
         (id, code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          boundary_version, policy_version, boundary, valid_from)
       VALUES
         ($1, 'cash-migration', 'CA', 'BC', 'Cash Migration Test', 'CAD',
          'America/Vancouver', ARRAY['en-CA'], 18, TRUE,
          'boundary-v1', 'policy-v1',
          ST_GeogFromText(
            'SRID=4326;MULTIPOLYGON(((-123.5 49.0,-122.8 49.0,-122.8 49.6,-123.5 49.6,-123.5 49.0)))'
          ),
          '2026-01-01')`,
      [ids.region],
    );
    await migrated.pool.query(
      `INSERT INTO competitions
         (id, region_policy_id, month_key, name, status, rules_version, rules,
          minimum_entrants, registration_opens_at, registration_closes_at,
          starts_at, ends_at)
       VALUES
         ($1, $2, '2026-09', 'Cash Migration Test', 'draft', 'rules-v1',
          '{}'::jsonb, 100, '2026-08-01', '2026-08-31',
          '2026-09-01', '2026-10-01')`,
      [ids.competition, ids.region],
    );
    await migrated.pool.query(
      `INSERT INTO reward_catalog_items
         (id, competition_id, sponsor_name, title, description, reward_type,
          status, image_url, terms_url, fulfillment_instructions,
          inventory_total, display_order, version)
       VALUES
         ($1, $2, 'Migration sponsor', 'Legacy physical reward',
          'A legacy reward snapshot that predates cash value columns.',
          'physical', 'draft', 'https://example.com/reward.jpg',
          'https://example.com/terms', 'Collect from the sponsor.', 1, 0, 1)`,
      [ids.reward, ids.competition],
    );
    await migrated.pool.query(
      `INSERT INTO competition_draws
         (id, competition_id, status, rules_version, seed_commitment,
          entrant_snapshot_hash, scoring_snapshot_hash, reward_snapshot_hash,
          public_result_snapshot_hash, entrant_count, total_entries,
          reward_slot_count, locked_at)
       VALUES
         ($1, $2, 'locked', 'rules-v1', repeat('a', 64), repeat('b', 64),
          repeat('c', 64), repeat('d', 64), repeat('e', 64), 1, 1, 1,
          '2026-10-02')`,
      [ids.draw, ids.competition],
    );
    await migrated.pool.query(
      `INSERT INTO draw_reward_catalog_snapshots
         (draw_id, reward_catalog_item_id, catalog_version, sponsor_name,
          title, reward_type, inventory_total, display_order,
          available_slot_count)
       VALUES
         ($1, $2, 1, 'Migration sponsor', 'Legacy physical reward',
          'physical', 1, 0, 1)`,
      [ids.draw, ids.reward],
    );

    await migrateTestDatabase(migrated.databaseUrl, '1787533200000');
  });

  afterAll(async () => {
    await migrated?.stop();
  });

  it('backfills existing snapshots and restores their append-only guard', async () => {
    const snapshot = await migrated.pool.query<{
      cash_amount_cents: number | null;
      cash_currency: string | null;
    }>(
      `SELECT cash_amount_cents, cash_currency
       FROM draw_reward_catalog_snapshots
       WHERE draw_id = $1 AND reward_catalog_item_id = $2`,
      [ids.draw, ids.reward],
    );
    const trigger = await migrated.pool.query<{ tgenabled: string }>(
      `SELECT tgenabled
       FROM pg_trigger
       WHERE tgname = 'draw_reward_catalog_snapshots_append_only'
         AND tgrelid = 'draw_reward_catalog_snapshots'::regclass
         AND NOT tgisinternal`,
    );

    expect(snapshot.rows).toEqual([
      { cash_amount_cents: null, cash_currency: null },
    ]);
    expect(trigger.rows).toEqual([{ tgenabled: 'O' }]);

    await expect(
      migrated.pool.query(
        `UPDATE draw_reward_catalog_snapshots
         SET title = title
         WHERE draw_id = $1 AND reward_catalog_item_id = $2`,
        [ids.draw, ids.reward],
      ),
    ).rejects.toThrow(/append-only/i);
  });
});
