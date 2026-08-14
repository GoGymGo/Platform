import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { GymsService } from '../src/modules/gyms/gyms.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { OperatorService } from '../src/modules/operator/operator.service';
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
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describeWithDatabase('authoritative region verification', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let gyms: GymsService;
  let migrated: MigratedPostgisTestDatabase;
  let operator: OperatorService;
  let profiles: ProfilesService;
  let regions: RegionsService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    profiles = new ProfilesService(database);
    const idempotency = new IdempotencyService(database);
    const adminAuthorization = new AdminAuthorizationService(profiles);
    regions = new RegionsService(database, idempotency, profiles);
    gyms = new GymsService(
      database,
      idempotency,
      new LedgerService(),
      profiles,
      adminAuthorization,
    );
    operator = new OperatorService(
      database,
      idempotency,
      {} as never,
      {} as never,
      profiles,
      {} as never,
      {} as never,
      adminAuthorization,
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
    const observedAt = new Date().toISOString();
    const request = {
      accuracyMeters: 8,
      latitude: 49.2827,
      longitude: -123.1207,
      method: 'device_location' as const,
      observedAt,
    };
    const verification = await regions.createVerification(
      principal,
      'region-inside-vancouver',
      request,
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
    await expect(
      regions.createVerification(principal, 'region-inside-vancouver', request),
    ).resolves.toEqual(verification);
    await expect(
      regions.createVerification(principal, 'region-inside-vancouver', {
        ...request,
        longitude: -123.1206,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });
  });

  it('rejects stale or inaccurate device samples before policy evaluation', async () => {
    await expect(
      regions.createVerification(principal, 'region-stale-reading', {
        accuracyMeters: 8,
        latitude: 49.2827,
        longitude: -123.1207,
        method: 'device_location',
        observedAt: new Date(Date.now() - 31_000).toISOString(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REGION_LOCATION_STALE' }),
    });
    await expect(
      regions.createVerification(principal, 'region-inaccurate-reading', {
        accuracyMeters: 51,
        latitude: 49.2827,
        longitude: -123.1207,
        method: 'device_location',
        observedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'REGION_LOCATION_ACCURACY_INSUFFICIENT',
      }),
    });
  });

  it('invalidates an approval when its policy is disabled or superseded', async () => {
    const policy = await database.connection
      .selectFrom('region_policies')
      .select(['id', 'policy_version'])
      .where('code', '=', 'vancouver-bc-integration')
      .executeTakeFirstOrThrow();
    await database.connection
      .updateTable('region_policies')
      .set({ competition_enabled: false })
      .where('id', '=', policy.id)
      .execute();
    await expect(regions.getCurrentVerification(principal)).resolves.toBeNull();
    await database.connection
      .updateTable('region_policies')
      .set({
        competition_enabled: true,
        policy_version: `${policy.policy_version}-superseded`,
      })
      .where('id', '=', policy.id)
      .execute();
    await expect(regions.getCurrentVerification(principal)).resolves.toBeNull();
    await database.connection
      .updateTable('region_policies')
      .set({ policy_version: policy.policy_version })
      .where('id', '=', policy.id)
      .execute();
  });

  it('normalizes waitlist retries, preserves review status, and links member privacy ownership', async () => {
    await expect(
      gyms.submitPublicWaitlist({
        consent: true,
        consentNoticeVersion: 'regional-updates-2026-08-13-v1',
        email: principal.email!,
        requestedRegion: '   ',
      }),
    ).rejects.toMatchObject({
      response: { code: 'REGION_WAITLIST_REGION_INVALID' },
    });

    const publicReceipt = await gyms.submitPublicWaitlist({
      consent: true,
      consentNoticeVersion: 'regional-updates-2026-08-13-v1',
      email: principal.email!,
      requestedRegion: '  North   Island  ',
    });
    expect(publicReceipt).toEqual({ status: 'received' });
    const initial = await database.connection
      .selectFrom('region_waitlist_entries')
      .selectAll()
      .where('email', '=', principal.email!)
      .executeTakeFirstOrThrow();
    await database.connection
      .updateTable('region_waitlist_entries')
      .set({ status: 'contacted' })
      .where('id', '=', initial.id)
      .execute();

    await gyms.submitPublicWaitlist({
      consent: true,
      consentNoticeVersion: 'regional-updates-2026-08-13-v1',
      email: principal.email!.toUpperCase(),
      requestedRegion: 'north island',
    });
    await gyms.submitMemberWaitlist(principal, {
      consent: true,
      consentNoticeVersion: 'regional-updates-2026-08-13-v1',
      requestedRegion: 'North Island',
    });

    const rows = await database.connection
      .selectFrom('region_waitlist_entries')
      .selectAll()
      .where('email', '=', principal.email!)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      consent_notice_version: 'regional-updates-2026-08-13-v1',
      requested_region_key: 'north island',
      status: 'contacted',
      user_id: expect.any(String),
    });
  });

  it('makes administrator region and waitlist decisions idempotent and audited', async () => {
    const adminPrincipal: AuthenticatedPrincipal = {
      email: 'region-admin@integration.test',
      emailVerified: true,
      firebaseUid: 'region-admin-user',
      roles: ['admin'],
      signInProvider: 'password',
      tokenIssuedAt: 1,
    };
    const admin = await database.connection
      .transaction()
      .execute((transaction) =>
        profiles.ensureUser(adminPrincipal, transaction),
      );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', admin.id)
      .execute();
    const target = await database.connection
      .insertInto('users')
      .values({
        created_at: new Date(),
        email: 'region-review-target@integration.test',
        email_verified: true,
        firebase_uid: 'region-review-target',
        roles: ['user'],
        status: 'active',
        updated_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const policy = await database.connection
      .selectFrom('region_policies')
      .select(['id', 'policy_version'])
      .where('code', '=', 'vancouver-bc-integration')
      .executeTakeFirstOrThrow();
    const pending = await database.connection
      .insertInto('region_verifications')
      .values({
        created_at: new Date(),
        evidence_metadata: {
          coordinatesRetained: false,
          source: 'client_device_location',
        },
        expires_at: null,
        method: 'device_location',
        policy_version: policy.policy_version,
        region_policy_id: policy.id,
        status: 'pending',
        user_id: target.id,
        verified_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const decision = {
      decision: 'rejected' as const,
      reason: 'Device evidence requires rejection.',
    };
    await expect(
      operator.decideRegionVerification(
        adminPrincipal,
        pending.id,
        'region-decision-idempotent',
        decision,
      ),
    ).resolves.toEqual({ id: pending.id, status: 'rejected' });
    await expect(
      operator.decideRegionVerification(
        adminPrincipal,
        pending.id,
        'region-decision-idempotent',
        decision,
      ),
    ).resolves.toEqual({ id: pending.id, status: 'rejected' });

    const waitlist = await database.connection
      .selectFrom('region_waitlist_entries')
      .select('id')
      .where('email', '=', principal.email!)
      .executeTakeFirstOrThrow();
    const waitlistDecision = {
      reason: 'Region is now approved for launch.',
      status: 'launched' as const,
    };
    await expect(
      gyms.updateWaitlistStatus(
        adminPrincipal,
        waitlist.id,
        'waitlist-decision-idempotent',
        waitlistDecision,
      ),
    ).resolves.toMatchObject({ id: waitlist.id, status: 'launched' });
    await expect(
      gyms.updateWaitlistStatus(
        adminPrincipal,
        waitlist.id,
        'waitlist-decision-idempotent',
        waitlistDecision,
      ),
    ).resolves.toMatchObject({ id: waitlist.id, status: 'launched' });
    const audits = await database.connection
      .selectFrom('operator_audit_events')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('request_id', 'in', [
        'region-decision-idempotent',
        'waitlist-decision-idempotent',
      ])
      .executeTakeFirstOrThrow();
    expect(Number(audits.count)).toBe(2);
  });

  it('rejects locations outside every active competition boundary', async () => {
    const before = await countVerifications();

    await expect(
      regions.createVerification(principal, 'region-outside-supported-area', {
        accuracyMeters: 8,
        latitude: 48.4284,
        longitude: -123.3656,
        method: 'device_location',
        observedAt: new Date().toISOString(),
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
            accuracyMeters: 8,
            latitude: 49.1659,
            longitude: -123.9401,
            method: 'device_location',
            observedAt: new Date().toISOString(),
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
        accuracyMeters: 8,
        latitude: 49.2827,
        longitude: -123.1207,
        method: 'device_location',
        observedAt: new Date().toISOString(),
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
