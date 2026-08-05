import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const principal: AuthenticatedPrincipal = {
  email: 'shared-profile@integration.test',
  emailVerified: true,
  firebaseUid: 'shared-browser-mobile-profile',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describeWithDatabase('browser and mobile profile synchronization', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('returns an identity written by one client to another client using the same Firebase user', async () => {
    const browserClient = new ProfilesService(database);
    const mobileClient = new ProfilesService(database);

    const updated = await browserClient.updateMe(principal, {
      publicIdentityMode: 'alias',
      publicName: 'SHARED_PLAYER',
      screenName: 'SHARED_PLAYER',
    });
    const restored = await mobileClient.getMe(principal);

    expect(restored).toMatchObject({
      callsign: updated.callsign,
      id: updated.id,
      publicIdentityMode: 'alias',
      publicName: 'SHARED_PLAYER',
      screenName: 'SHARED_PLAYER',
      version: updated.version,
    });
  });
});
