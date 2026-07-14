import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { DemoCheckpointTypeDto } from '../src/modules/verification/dto/demo-check-in.dto';
import { DemoVerificationService } from '../src/modules/verification/demo-verification.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const principal: AuthenticatedPrincipal = {
  email: 'demo-verification-user@integration.test',
  emailVerified: true,
  firebaseUid: 'demo-verification-user',
  roles: ['user'],
  tokenIssuedAt: 1,
};

describeWithDatabase('demo verification workflow', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let service: DemoVerificationService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    const config = createTestConfig(migrated.databaseUrl, {
      DEMO_VERIFICATION_ENABLED: 'true',
      DEMO_VERIFICATION_REGION_CODE: 'CA-BC',
      DEMO_VERIFICATION_TTL_SECONDS: '300',
    });
    database = new DatabaseService(config);
    const profiles = new ProfilesService(database);
    service = new DemoVerificationService(
      config,
      new IdempotencyService(database),
      profiles,
    );
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('records one short-lived, retry-safe checkpoint without evidence fields', async () => {
    const request = {
      checkpointType: DemoCheckpointTypeDto.SESSION_START,
      regionCode: 'CA-BC',
    };
    const first = await service.createCheckIn(
      principal,
      'demo-check-in-integration-1',
      request,
    );
    const retry = await service.createCheckIn(
      principal,
      'demo-check-in-integration-1',
      request,
    );

    expect(retry).toEqual(first);
    expect(first).toEqual(
      expect.objectContaining({
        checkpointType: 'session_start',
        demo: true,
        outcome: 'simulated',
        provider: 'canada_demo',
        regionCode: 'CA-BC',
      }),
    );
    expect(
      new Date(first.expiresAt).getTime() - new Date(first.issuedAt).getTime(),
    ).toBe(300_000);

    const stored = await migrated.pool.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM demo_verification_checkpoints`,
    );
    expect(stored.rows[0].count).toBe(1);
    const columns = await migrated.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'demo_verification_checkpoints'`,
    );
    expect(columns.rows.map((row) => row.column_name)).not.toEqual(
      expect.arrayContaining([
        'biometric_data',
        'camera_frame',
        'face_scan',
        'heart_rate',
      ]),
    );
  });

  it('rejects regions outside the configured Canadian demo ground', async () => {
    await expect(
      service.createCheckIn(principal, 'demo-check-in-integration-2', {
        checkpointType: DemoCheckpointTypeDto.SESSION_START,
        regionCode: 'CA-ON',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DEMO_VERIFICATION_REGION_UNAVAILABLE',
      }),
    });
  });
});
