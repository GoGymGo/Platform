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

  it('converges concurrent first-use retries on one user and one profile', async () => {
    const retryPrincipal: AuthenticatedPrincipal = {
      ...principal,
      email: 'retry-profile@integration.test',
      firebaseUid: 'concurrent-profile-retry',
      roles: ['admin'],
    };
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        new ProfilesService(database).getMe(retryPrincipal),
      ),
    );

    expect(new Set(responses.map(({ id }) => id)).size).toBe(1);
    expect(new Set(responses.map(({ callsign }) => callsign)).size).toBe(1);
    expect(responses.every(({ roles }) => roles.join(',') === 'user')).toBe(
      true,
    );

    const userRows = await database.connection
      .selectFrom('users')
      .select('id')
      .where('firebase_uid', '=', retryPrincipal.firebaseUid)
      .execute();
    const profileRows = await database.connection
      .selectFrom('profiles')
      .select('user_id')
      .where('user_id', '=', responses[0].id)
      .execute();

    expect(userRows).toHaveLength(1);
    expect(profileRows).toHaveLength(1);
  });

  it('does not reactivate a suspended database account during profile synchronization', async () => {
    const suspendedPrincipal: AuthenticatedPrincipal = {
      ...principal,
      email: 'suspended-profile@integration.test',
      firebaseUid: 'suspended-profile-user',
    };
    const profiles = new ProfilesService(database);
    const created = await profiles.getMe(suspendedPrincipal);
    await database.connection
      .updateTable('users')
      .set({ status: 'suspended' })
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();

    await expect(profiles.getMe(suspendedPrincipal)).rejects.toMatchObject({
      response: { code: 'ACCOUNT_NOT_ACTIVE' },
    });
    await expect(
      database.connection
        .selectFrom('users')
        .select('status')
        .where('id', '=', created.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({ status: 'suspended' });
  });
});
