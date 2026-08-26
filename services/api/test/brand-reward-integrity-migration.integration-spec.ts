import type { DatabaseError } from 'pg';
import {
  migrateTestDatabase,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

interface RewardCatalogItem {
  title: string;
  status: string;
  version: number;
  updated_at: Date;
}

describeWithDatabase('brand reward integrity migration', () => {
  jest.setTimeout(180_000);

  const originalUpdatedAt = new Date('2026-01-01T00:00:00.000Z');
  let migrated: MigratedPostgisTestDatabase;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase('1787274000000');

    const region = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          boundary_version, policy_version, boundary, valid_from)
       VALUES
         ('brand-reward-migration', 'CA', 'BC', 'Brand Reward Test', 'CAD',
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
         ($1, '2026-09', 'Brand Reward Migration', 'draft', 'rules-v1',
          '{}'::jsonb, 100, '2026-08-01', '2026-08-31',
          '2026-09-01', '2026-10-01')
       RETURNING id`,
      [region.rows[0].id],
    );

    await migrated.pool.query(
      `INSERT INTO reward_catalog_items
         (competition_id, sponsor_name, title, description, reward_type,
          status, image_url, terms_url, fulfillment_instructions,
          inventory_total, display_order, version, created_at, updated_at)
       VALUES
         ($1, 'Migration sponsor', 'Missing image', 'Missing image legacy row',
          'physical', 'published', NULL, 'https://example.com/terms',
          'Collect from the sponsor.', 1, 0, 2, $2, $2),
         ($1, 'Migration sponsor', 'Missing terms', 'Missing terms legacy row',
          'physical', 'published', 'https://example.com/image.jpg', NULL,
          'Collect from the sponsor.', 1, 1, 3, $2, $2),
         ($1, 'Migration sponsor', 'Missing both', 'Missing both legacy row',
          'physical', 'published', NULL, NULL,
          'Collect from the sponsor.', 1, 2, 4, $2, $2),
         ($1, 'Migration sponsor', 'Valid published', 'Valid published row',
          'physical', 'published', 'https://example.com/image.jpg',
          'https://example.com/terms', 'Collect from the sponsor.',
          1, 3, 5, $2, $2),
         ($1, 'Migration sponsor', 'Draft missing assets', 'Draft legacy row',
          'physical', 'draft', NULL, NULL, 'Collect from the sponsor.',
          1, 4, 6, $2, $2),
         ($1, 'Migration sponsor', 'Archived missing assets',
          'Archived legacy row', 'physical', 'archived', NULL, NULL,
          'Collect from the sponsor.', 1, 5, 7, $2, $2)`,
      [competition.rows[0].id, originalUpdatedAt],
    );

    await migrateTestDatabase(migrated.databaseUrl, '1787360400000');
  });

  afterAll(async () => {
    await migrated?.stop();
  });

  it('archives only published legacy rows missing required assets and advances their audit fields', async () => {
    const rewards = await migrated.pool.query<RewardCatalogItem>(
      `SELECT title, status::text, version, updated_at
       FROM reward_catalog_items
       ORDER BY display_order`,
    );

    expect(rewards.rows).toEqual([
      expect.objectContaining({
        title: 'Missing image',
        status: 'archived',
        version: 3,
      }),
      expect.objectContaining({
        title: 'Missing terms',
        status: 'archived',
        version: 4,
      }),
      expect.objectContaining({
        title: 'Missing both',
        status: 'archived',
        version: 5,
      }),
      {
        title: 'Valid published',
        status: 'published',
        version: 5,
        updated_at: originalUpdatedAt,
      },
      {
        title: 'Draft missing assets',
        status: 'draft',
        version: 6,
        updated_at: originalUpdatedAt,
      },
      {
        title: 'Archived missing assets',
        status: 'archived',
        version: 7,
        updated_at: originalUpdatedAt,
      },
    ]);

    for (const reward of rewards.rows.slice(0, 3)) {
      expect(reward.updated_at.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    }
  });

  it('installs and validates the published-assets constraint after cleanup', async () => {
    const constraint = await migrated.pool.query<{ convalidated: boolean }>(
      `SELECT convalidated
       FROM pg_constraint
       WHERE conname = 'reward_catalog_published_assets'
         AND conrelid = 'reward_catalog_items'::regclass`,
    );

    expect(constraint.rows).toEqual([{ convalidated: true }]);

    await expect(
      migrated.pool.query(
        `UPDATE reward_catalog_items
         SET status = 'published', version = version + 1
         WHERE title = 'Draft missing assets'`,
      ),
    ).rejects.toMatchObject<Partial<DatabaseError>>({
      constraint: 'reward_catalog_published_assets',
    });
  });
});
