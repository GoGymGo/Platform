import type { DatabaseError } from 'pg';
import {
  migrateTestDatabase,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

describeWithDatabase('optional reward images migration', () => {
  jest.setTimeout(180_000);

  let migrated: MigratedPostgisTestDatabase;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase('1788224400000');
    const region = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          boundary_version, policy_version, boundary, valid_from)
       VALUES
         ('optional-reward-image', 'CA', 'BC', 'Optional Image Test', 'CAD',
          'America/Vancouver', ARRAY['en-CA'], 19, TRUE,
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
         ($1, '2026-10', 'Optional Reward Image', 'draft', 'rules-v1',
          '{}'::jsonb, 1, '2026-09-01', '2026-09-30',
          '2026-10-01', '2026-11-01')
       RETURNING id`,
      [region.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO reward_catalog_items
         (competition_id, sponsor_name, title, description, reward_type,
          status, image_url, terms_url, fulfillment_instructions,
          inventory_total, display_order)
       VALUES
         ($1, 'GoGymGo', 'No custom image', 'Uses the built-in illustration.',
          'physical', 'draft', NULL, 'https://app.gogymgo.com/terms-of-service',
          'Collect from the partner gym.', 1, 0),
         ($1, 'GoGymGo', 'Missing terms', 'Cannot publish without terms.',
          'physical', 'draft', 'https://gogymgo.com/reward.jpg', NULL,
          'Collect from the partner gym.', 1, 1)`,
      [competition.rows[0].id],
    );
    await migrateTestDatabase(migrated.databaseUrl, '1788310800000');
  });

  afterAll(async () => {
    await migrated?.stop();
  });

  it('allows a published reward to use the member-app illustration', async () => {
    await expect(
      migrated.pool.query(
        `UPDATE reward_catalog_items
         SET status = 'published', version = version + 1
         WHERE title = 'No custom image'`,
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('continues to require terms for every published reward', async () => {
    await expect(
      migrated.pool.query(
        `UPDATE reward_catalog_items
         SET status = 'published', version = version + 1
         WHERE title = 'Missing terms'`,
      ),
    ).rejects.toMatchObject<Partial<DatabaseError>>({
      constraint: 'reward_catalog_published_assets',
    });
  });
});
