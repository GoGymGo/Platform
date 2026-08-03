import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { RegionsService } from '../src/modules/regions/regions.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const principal: AuthenticatedPrincipal = {
  email: 'region-user@integration.test',
  emailVerified: true,
  firebaseUid: 'authoritative-region-user',
  roles: ['user'],
  tokenIssuedAt: 1,
};

describeWithDatabase('authoritative region verification', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let regions: RegionsService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const profiles = new ProfilesService(database);
    regions = new RegionsService(
      database,
      new IdempotencyService(database),
      profiles,
    );
    await migrated.pool.query(`
      INSERT INTO region_policies
        (code, country_code, subdivision_code, metro_name, currency, timezone,
         language_codes, minimum_age, competition_enabled, boundary_version,
         policy_version, boundary, valid_from)
      VALUES
        ('vancouver-bc-integration', 'CA', 'BC', 'Vancouver Integration',
         'CAD', 'America/Vancouver', ARRAY['en-CA'], 19, TRUE,
         'vancouver-boundary-v1', 'vancouver-policy-v1',
         ST_GeogFromText(
           'SRID=4326;MULTIPOLYGON(((-123.4 49.0,-122.8 49.0,-122.8 49.5,-123.4 49.5,-123.4 49.0)))'
         ),
         current_timestamp - interval '1 day')
    `);
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('selects the region by its server boundary and stores no coordinates', async () => {
    const verification = await regions.createVerification(
      principal,
      'region-inside-vancouver',
      {
        latitude: 49.2827,
        longitude: -123.1207,
        method: 'device_location',
      },
    );

    expect(verification).toMatchObject({
      jurisdictionCode: 'CA-BC',
      method: 'device_location',
      regionCode: 'vancouver-bc-integration',
      regionName: 'Vancouver Integration',
      reviewedAt: expect.any(String),
      status: 'approved',
      timezone: 'America/Vancouver',
    });
    expect(Date.parse(verification.expiresAt)).toBeGreaterThan(Date.now());

    const stored = await database.connection
      .selectFrom('region_verifications')
      .select(['evidence_metadata', 'expires_at', 'status', 'verified_at'])
      .where('id', '=', verification.id)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({
      evidence_metadata: {
        boundaryVersion: 'vancouver-boundary-v1',
        containment: 'inside',
        coordinatesRetained: false,
        source: 'client_device_location',
      },
      expires_at: expect.any(Date),
      status: 'approved',
      verified_at: expect.any(Date),
    });
    expect(JSON.stringify(stored.evidence_metadata)).not.toMatch(
      /latitude|longitude|postal/i,
    );

    await expect(
      regions.getCurrentVerification(principal, 'vancouver-bc-integration'),
    ).resolves.toMatchObject({ id: verification.id, status: 'approved' });
    await expect(
      regions.getCurrentVerification(principal),
    ).resolves.toMatchObject({
      id: verification.id,
      regionCode: 'vancouver-bc-integration',
      status: 'approved',
    });
  });

  it('rejects locations outside every active competition boundary', async () => {
    const before = await countVerifications();

    await expect(
      regions.createVerification(principal, 'region-outside-supported-area', {
        latitude: 48.4284,
        longitude: -123.3656,
        method: 'device_location',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'LOCATION_OUTSIDE_SUPPORTED_REGION',
      }),
    });
    await expect(countVerifications()).resolves.toBe(before);
  });

  it('reports an unavailable service when no competition region is active', async () => {
    const unavailablePrincipal: AuthenticatedPrincipal = {
      ...principal,
      firebaseUid: 'region-unavailable-user',
    };
    await database.connection
      .updateTable('region_policies')
      .set({ competition_enabled: false })
      .execute();

    try {
      await expect(
        regions.createVerification(
          unavailablePrincipal,
          'region-verification-unavailable',
          {
            latitude: 49.1659,
            longitude: -123.9401,
            method: 'device_location',
          },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'REGION_VERIFICATION_UNAVAILABLE',
        }),
        status: 503,
      });
    } finally {
      await database.connection
        .updateTable('region_policies')
        .set({ competition_enabled: true })
        .execute();
    }
  });

  it('fails closed when active competition boundaries overlap', async () => {
    await migrated.pool.query(`
      INSERT INTO region_policies
        (code, country_code, subdivision_code, metro_name, currency, timezone,
         language_codes, minimum_age, competition_enabled, boundary_version,
         policy_version, boundary, valid_from)
      VALUES
        ('overlap-bc-integration', 'CA', 'BC', 'Overlap Integration',
         'CAD', 'America/Vancouver', ARRAY['en-CA'], 19, TRUE,
         'overlap-boundary-v1', 'overlap-policy-v1',
         ST_GeogFromText(
           'SRID=4326;MULTIPOLYGON(((-123.2 49.1,-123.0 49.1,-123.0 49.4,-123.2 49.4,-123.2 49.1)))'
         ),
         current_timestamp - interval '1 day')
    `);
    const conflictPrincipal: AuthenticatedPrincipal = {
      ...principal,
      firebaseUid: 'overlapping-region-user',
    };

    await expect(
      regions.createVerification(conflictPrincipal, 'region-overlap-conflict', {
        latitude: 49.2827,
        longitude: -123.1207,
        method: 'device_location',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'REGION_BOUNDARY_CONFIGURATION_CONFLICT',
      }),
    });
  });

  async function countVerifications() {
    const result = await database.connection
      .selectFrom('region_verifications')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }
});
