import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { sql } from 'kysely';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { GymsService } from '../src/modules/gyms/gyms.service';
import { hashOpaqueValue } from '../src/modules/gyms/gym-scan-policy';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const principal: AuthenticatedPrincipal = {
  email: 'qr-pilot-user@integration.test',
  emailVerified: true,
  firebaseUid: 'qr-pilot-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const credential = 'qr-pilot-static-credential';
const gymLatitude = 48.4284;
const gymLongitude = -123.3656;

describeWithDatabase('connected static QR pilot', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let gyms: GymsService;
  let sessions: SessionsService;
  let competitionId: string;
  let gymId: string;
  let regionId: string;
  let regionVerificationId: string;
  let userId: string;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const idempotency = new IdempotencyService(database);
    const profiles = new ProfilesService(database);
    gyms = new GymsService(
      database,
      idempotency,
      new LedgerService(),
      profiles,
      new AdminAuthorizationService(profiles),
    );
    sessions = new SessionsService(
      database,
      idempotency,
      new LedgerService(),
      profiles,
    );
    userId = (await profiles.ensureUser(principal, database.connection)).id;
    gymId = await seedPilot();
  });

  beforeEach(async () => {
    await migrated.pool.query(
      'TRUNCATE entry_ledger, gym_scan_events, workout_sessions CASCADE',
    );
    await database.connection
      .deleteFrom('idempotency_keys')
      .where('actor_key', '=', `firebase:${principal.firebaseUid}`)
      .execute();
    await database.connection
      .updateTable('gym_qr_credentials')
      .set({
        revocation_reason: null,
        revoked_at: null,
        revoked_by_user_id: null,
        status: 'active',
      })
      .where('gym_location_id', '=', gymId)
      .execute();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('starts once and returns the same result for an idempotent replay', async () => {
    const request = scanRequest('idempotent-event');
    const first = await gyms.scan(principal, 'idempotent-key', request);
    const replay = await gyms.scan(principal, 'idempotent-key', request);

    expect(first.outcome).toBe('started');
    expect(replay).toEqual(first);
    await expect(scanEventCount()).resolves.toBe(1);
  });

  it('cancels a started static QR workout and releases the active-session slot', async () => {
    const started = await gyms.scan(
      principal,
      'member-cancel-start',
      scanRequest('member-cancel-start-event'),
    );

    const cancelled = await sessions.cancel(
      principal,
      started.sessionId!,
      'member-cancel-session',
    );
    expect(cancelled).toMatchObject({
      completedAt: expect.any(String),
      id: started.sessionId,
      status: 'cancelled',
    });
    await expect(
      sessions.cancel(principal, started.sessionId!, 'member-cancel-session'),
    ).resolves.toEqual(cancelled);
    await expect(
      database.connection
        .selectFrom('entry_ledger')
        .select('id')
        .where('user_id', '=', userId)
        .execute(),
    ).resolves.toHaveLength(0);
    await expect(
      database.connection
        .selectFrom('competition_progress')
        .select(['category_score', 'prize_draw_entries', 'verified_days'])
        .where('competition_id', '=', competitionId)
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow(),
    ).resolves.toMatchObject({
      category_score: 0,
      prize_draw_entries: 1,
      verified_days: 0,
    });
    await expect(
      gyms.scan(
        principal,
        'member-cancel-restart',
        scanRequest('member-cancel-restart-event'),
      ),
    ).resolves.toMatchObject({ outcome: 'started' });
  });

  it('starts from the enrolled gym with fresh location and no QR credential', async () => {
    await database.connection
      .updateTable('gym_qr_credentials')
      .set({
        revocation_reason:
          'The enrollment must not depend on a retained QR secret.',
        revoked_at: new Date(),
        revoked_by_user_id: userId,
        status: 'revoked',
      })
      .where('gym_location_id', '=', gymId)
      .execute();

    const result = await gyms.scan(principal, 'enrolled-location-key', {
      accuracyMeters: 10,
      competitionId,
      eventId: '10000000-0000-4000-8000-000000000091',
      latitude: gymLatitude,
      longitude: gymLongitude,
    });

    expect(result).toMatchObject({
      gymLocationId: gymId,
      outcome: 'started',
    });
  });

  it('serializes concurrent scans into one start and one early result', async () => {
    const results = await Promise.all([
      gyms.scan(principal, 'concurrent-a', scanRequest('concurrent-event-a')),
      gyms.scan(principal, 'concurrent-b', scanRequest('concurrent-event-b')),
    ]);
    expect(results.map((result) => result.outcome).sort()).toEqual([
      'started',
      'too_early',
    ]);
  });

  it('rejects poor accuracy, revoked credentials and replayed client events', async () => {
    const inaccuratePoint = await projectedPoint(125.5);
    await expect(
      gyms.scan(principal, 'accuracy-key', {
        ...scanRequest(
          'accuracy-event',
          inaccuratePoint.latitude,
          inaccuratePoint.longitude,
        ),
        accuracyMeters: 50.01,
      }),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'inaccurate_location',
    });

    await database.connection
      .updateTable('gym_qr_credentials')
      .set({
        revocation_reason: 'Integration revocation test',
        revoked_at: new Date(),
        revoked_by_user_id: userId,
        status: 'revoked',
      })
      .where('gym_location_id', '=', gymId)
      .execute();
    await expect(
      gyms.scan(principal, 'revoked-key', scanRequest('revoked-event')),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'invalid_or_revoked_credential',
    });

    await database.connection
      .updateTable('gym_qr_credentials')
      .set({
        revocation_reason: null,
        revoked_at: null,
        revoked_by_user_id: null,
        status: 'active',
      })
      .where('gym_location_id', '=', gymId)
      .execute();
    await gyms.scan(principal, 'replay-start', scanRequest('replay-event'));
    await expect(
      gyms.scan(principal, 'replay-second', scanRequest('replay-event')),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'replayed_event',
    });
  });

  it('caps coarse location uncertainty without expanding the maximum allowance', async () => {
    const nearby = await projectedPoint(125);
    await expect(
      gyms.scan(principal, 'coarse-nearby-key', {
        ...scanRequest(
          'coarse-nearby-event',
          nearby.latitude,
          nearby.longitude,
        ),
        accuracyMeters: 100_000,
      }),
    ).resolves.toMatchObject({ outcome: 'started' });

    await database.connection.deleteFrom('gym_scan_events').execute();
    await database.connection.deleteFrom('workout_sessions').execute();
    const tooFar = await projectedPoint(125.5);
    await expect(
      gyms.scan(principal, 'coarse-too-far-key', {
        ...scanRequest(
          'coarse-too-far-event',
          tooFar.latitude,
          tooFar.longitude,
        ),
        accuracyMeters: 100_000,
      }),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'inaccurate_location',
    });
  });

  it('uses reported accuracy at the 75 m geofence boundary', async () => {
    const point = await projectedPoint(85);
    await expect(
      gyms.scan(
        principal,
        'boundary-key',
        scanRequest('boundary-event', point.latitude, point.longitude),
      ),
    ).resolves.toMatchObject({ outcome: 'started' });

    await database.connection.deleteFrom('gym_scan_events').execute();
    await database.connection.deleteFrom('workout_sessions').execute();
    const outside = await projectedPoint(85.5);
    await expect(
      gyms.scan(
        principal,
        'outside-key',
        scanRequest('outside-event', outside.latitude, outside.longitude),
      ),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'outside_geofence',
    });
  });

  it('uses server time to verify after 30 minutes and deduplicates the day', async () => {
    const started = await gyms.scan(
      principal,
      'verify-start',
      scanRequest('verify-start-event'),
    );
    await database.connection
      .updateTable('workout_sessions')
      .set({ started_at: new Date(Date.now() - 31 * 60_000) })
      .where('id', '=', started.sessionId!)
      .execute();

    await expect(
      gyms.scan(principal, 'verify-exit', scanRequest('verify-exit-event')),
    ).resolves.toMatchObject({ outcome: 'verified', remainingSeconds: 0 });
    await expect(
      gyms.scan(principal, 'verify-again', scanRequest('verify-again-event')),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'daily_limit_reached',
    });
    const ledger = await database.connection
      .selectFrom('entry_ledger')
      .select('id')
      .where('user_id', '=', userId)
      .execute();
    expect(ledger).toHaveLength(1);
  });

  it('requires a fresh in-gym location to finish without another QR capture', async () => {
    const started = await gyms.scan(
      principal,
      'location-finish-start',
      scanRequest('location-finish-start-event'),
    );
    await database.connection
      .updateTable('workout_sessions')
      .set({ started_at: new Date(Date.now() - 31 * 60_000) })
      .where('id', '=', started.sessionId!)
      .execute();

    const outside = await projectedPoint(85.5);
    await expect(
      gyms.scan(
        principal,
        'location-finish-outside',
        scanRequest(
          'location-finish-outside-event',
          outside.latitude,
          outside.longitude,
        ),
      ),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'outside_geofence',
    });
    await expect(
      gyms.scan(
        principal,
        'location-finish-inside',
        scanRequest('location-finish-inside-event'),
      ),
    ).resolves.toMatchObject({ outcome: 'verified', remainingSeconds: 0 });
  });

  it('requires the same static credential version for entry and exit', async () => {
    const started = await gyms.scan(
      principal,
      'credential-version-start',
      scanRequest('credential-version-start-event'),
    );
    const replacementCredential = 'qr-pilot-replacement-credential';
    await database.connection
      .updateTable('gym_qr_credentials')
      .set({
        revocation_reason: 'Reissued during integration test',
        revoked_at: new Date(),
        revoked_by_user_id: userId,
        status: 'revoked',
      })
      .where('gym_location_id', '=', gymId)
      .where('credential_version', '=', 1)
      .execute();
    const replacement = await database.connection
      .insertInto('gym_qr_credentials')
      .values({
        competition_id: competitionId,
        credential_version: 2,
        gym_location_id: gymId,
        issued_at: new Date(),
        issued_by_user_id: userId,
        status: 'active',
        token_hash: hashOpaqueValue(replacementCredential),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    try {
      await database.connection
        .updateTable('workout_sessions')
        .set({ started_at: new Date(Date.now() - 31 * 60_000) })
        .where('id', '=', started.sessionId!)
        .execute();
      await expect(
        gyms.scan(principal, 'credential-version-exit', {
          ...scanRequest('credential-version-exit-event'),
          credential: replacementCredential,
        }),
      ).resolves.toMatchObject({
        outcome: 'rejected',
        rejectionReason: 'session_credential_mismatch',
      });
    } finally {
      await database.connection
        .deleteFrom('gym_qr_credentials')
        .where('id', '=', replacement.id)
        .execute();
      await database.connection
        .updateTable('gym_qr_credentials')
        .set({
          revocation_reason: null,
          revoked_at: null,
          revoked_by_user_id: null,
          status: 'active',
        })
        .where('gym_location_id', '=', gymId)
        .where('credential_version', '=', 1)
        .execute();
    }
  });

  it('expires missing exits without awarding credit', async () => {
    const started = await gyms.scan(
      principal,
      'expiry-start',
      scanRequest('expiry-start-event'),
    );
    await database.connection
      .updateTable('workout_sessions')
      .set({ expires_at: new Date(Date.now() - 1_000) })
      .where('id', '=', started.sessionId!)
      .execute();
    await expect(
      gyms.scan(principal, 'expiry-exit', scanRequest('expiry-exit-event')),
    ).resolves.toMatchObject({
      outcome: 'rejected',
      rejectionReason: 'session_expired',
    });
    const session = await database.connection
      .selectFrom('workout_sessions')
      .select('status')
      .where('id', '=', started.sessionId!)
      .executeTakeFirstOrThrow();
    expect(session.status).toBe('cancelled');
    await expect(scanEventCount()).resolves.toBe(2);
  });

  it('verifies a 30-minute workout during the 15-minute completion period', async () => {
    const started = await gyms.scan(
      principal,
      'grace-finish-start',
      scanRequest('grace-finish-start-event'),
    );
    const now = Date.now();
    try {
      await database.connection
        .updateTable('workout_sessions')
        .set({ started_at: new Date(now - 31 * 60_000) })
        .where('id', '=', started.sessionId!)
        .execute();
      await database.connection
        .updateTable('competitions')
        .set({ ends_at: new Date(now - 5 * 60_000) })
        .where('id', '=', competitionId)
        .execute();

      await expect(
        gyms.scan(
          principal,
          'grace-finish-exit',
          scanRequest('grace-finish-exit-event'),
        ),
      ).resolves.toMatchObject({ outcome: 'verified', remainingSeconds: 0 });
    } finally {
      await database.connection
        .updateTable('competitions')
        .set({ ends_at: new Date(Date.now() + 24 * 60 * 60_000) })
        .where('id', '=', competitionId)
        .execute();
    }
  });

  it('rejects starts that cannot reach 30 minutes before the completion deadline', async () => {
    try {
      await database.connection
        .updateTable('competitions')
        .set({ ends_at: new Date(Date.now() + 14 * 60_000) })
        .where('id', '=', competitionId)
        .execute();

      await expect(
        gyms.scan(principal, 'late-start-key', scanRequest('late-start-event')),
      ).resolves.toMatchObject({
        outcome: 'rejected',
        rejectionReason: 'insufficient_completion_time',
      });
    } finally {
      await database.connection
        .updateTable('competitions')
        .set({ ends_at: new Date(Date.now() + 24 * 60 * 60_000) })
        .where('id', '=', competitionId)
        .execute();
    }
  });

  it('cancels an unfinished workout after the completion period ends', async () => {
    const started = await gyms.scan(
      principal,
      'expired-grace-start',
      scanRequest('expired-grace-start-event'),
    );
    const now = Date.now();
    try {
      await database.connection
        .updateTable('workout_sessions')
        .set({ started_at: new Date(now - 31 * 60_000) })
        .where('id', '=', started.sessionId!)
        .execute();
      await database.connection
        .updateTable('competitions')
        .set({ ends_at: new Date(now - 16 * 60_000) })
        .where('id', '=', competitionId)
        .execute();

      await expect(
        gyms.scan(
          principal,
          'expired-grace-exit',
          scanRequest('expired-grace-exit-event'),
        ),
      ).resolves.toMatchObject({
        outcome: 'rejected',
        rejectionReason: 'completion_grace_expired',
      });
      await expect(
        database.connection
          .selectFrom('workout_sessions')
          .select('status')
          .where('id', '=', started.sessionId!)
          .executeTakeFirstOrThrow(),
      ).resolves.toMatchObject({ status: 'cancelled' });
    } finally {
      await database.connection
        .updateTable('competitions')
        .set({ ends_at: new Date(Date.now() + 24 * 60 * 60_000) })
        .where('id', '=', competitionId)
        .execute();
    }
  });

  it('keeps two active contest posters at one gym and scans into the poster contest', async () => {
    const now = Date.now();
    const original = await database.connection
      .selectFrom('competitions')
      .select(['rules', 'rules_version'])
      .where('id', '=', competitionId)
      .executeTakeFirstOrThrow();
    const secondCompetition = await database.connection
      .insertInto('competitions')
      .values({
        ends_at: new Date(now + 48 * 60 * 60_000),
        minimum_entrants: 1,
        month_key: '2026-10',
        name: 'Second Same Gym Competition',
        region_policy_id: regionId,
        registration_closes_at: new Date(now - 2 * 60 * 60_000),
        registration_opens_at: new Date(now - 48 * 60 * 60_000),
        rules: original.rules,
        rules_version: original.rules_version,
        starts_at: new Date(now - 60 * 60_000),
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('competition_goal_brackets')
      .values({
        competition_id: secondCompetition.id,
        created_at: new Date(),
        goal_days: 3,
        label: '3 DAYS / WEEK',
      })
      .execute();
    const acceptance = await database.connection
      .insertInto('competition_rule_acceptances')
      .values({
        accepted_at: new Date(),
        age_eligibility_attested: true,
        competition_id: secondCompetition.id,
        metadata: {},
        rules_version: original.rules_version,
        user_id: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const enrollment = await database.connection
      .insertInto('competition_enrollments')
      .values({
        competition_id: secondCompetition.id,
        enrolled_at: new Date(),
        goal_days: 3,
        gym_credential_version: 2,
        gym_location_id: gymId,
        region_verification_id: regionVerificationId,
        rules_acceptance_id: acceptance.id,
        status: 'active',
        user_id: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('competition_progress')
      .values({
        category_score: 0,
        competition_id: secondCompetition.id,
        enrollment_id: enrollment.id,
        goal_days: 3,
        prize_draw_entries: 1,
        updated_at: new Date(),
        user_id: userId,
        verified_days: 0,
      })
      .execute();
    await database.connection
      .insertInto('competition_gym_locations')
      .values({
        competition_id: secondCompetition.id,
        created_at: new Date(),
        gym_location_id: gymId,
      })
      .execute();
    const secondCredential = 'second-contest-same-gym-credential';
    await database.connection
      .insertInto('gym_qr_credentials')
      .values({
        competition_id: secondCompetition.id,
        credential_version: 2,
        gym_location_id: gymId,
        issued_at: new Date(),
        issued_by_user_id: userId,
        status: 'active',
        token_hash: hashOpaqueValue(secondCredential),
      })
      .execute();

    const result = await gyms.scan(principal, 'second-contest-scan', {
      ...scanRequest('second-contest-event'),
      credential: secondCredential,
    });
    expect(result.outcome).toBe('started');
    const session = await database.connection
      .selectFrom('workout_sessions')
      .select('competition_id')
      .where('id', '=', result.sessionId!)
      .executeTakeFirstOrThrow();
    expect(session.competition_id).toBe(secondCompetition.id);

    const activePosters = await database.connection
      .selectFrom('gym_qr_credentials')
      .select('competition_id')
      .where('gym_location_id', '=', gymId)
      .where('status', '=', 'active')
      .execute();
    expect(
      new Set(activePosters.map((poster) => poster.competition_id)),
    ).toEqual(new Set([competitionId, secondCompetition.id]));
  });

  function scanRequest(
    eventId: string,
    latitude = gymLatitude,
    longitude = gymLongitude,
  ) {
    return {
      accuracyMeters: 10,
      credential,
      eventId,
      latitude,
      longitude,
    };
  }

  async function scanEventCount(): Promise<number> {
    const result = await database.connection
      .selectFrom('gym_scan_events')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async function projectedPoint(distanceMeters: number): Promise<{
    latitude: number;
    longitude: number;
  }> {
    const result = await migrated.pool.query<{
      latitude: number;
      longitude: number;
    }>(
      `SELECT
         ST_Y(projected::geometry) AS latitude,
         ST_X(projected::geometry) AS longitude
       FROM (
         SELECT ST_Project(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3::double precision,
           radians(90::double precision)
         ) AS projected
       ) AS point`,
      [gymLongitude, gymLatitude, distanceMeters],
    );
    return {
      latitude: Number(result.rows[0].latitude),
      longitude: Number(result.rows[0].longitude),
    };
  }

  async function seedPilot(): Promise<string> {
    const region = await database.connection
      .insertInto('region_policies')
      .values({
        boundary: sql`ST_GeogFromText(
          'SRID=4326;MULTIPOLYGON(((-124 48,-123 48,-123 50,-124 50,-124 48)))'
        )`,
        boundary_version: 'qr-boundary-v1',
        code: 'qr-integration-region',
        competition_enabled: true,
        country_code: 'CA',
        currency: 'CAD',
        language_codes: ['en-CA'],
        metro_name: 'QR Integration Region',
        minimum_age: 19,
        policy_version: 'qr-policy-v1',
        subdivision_code: 'BC',
        timezone: 'America/Vancouver',
        valid_from: new Date('2026-01-01T00:00:00.000Z'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    regionId = region.id;
    const now = Date.now();
    const rules = {
      categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
      minHeartRateSamples: 0,
      minSessionMinutes: 30,
      perfectMonthMultiplier: 10,
      requireDeviceAttestation: false,
      requireGymQr: true,
      requirePresenceCheck: false,
      signupPrizeDrawEntries: 1,
      verifiedSessionCategoryScore: 1,
      verifiedSessionPrizeDrawEntries: 1,
      weeklyChallengeBothHitMultiplier: 2,
      weeklyChallengeRecoveryMultiplier: 3,
    };
    const competition = await database.connection
      .insertInto('competitions')
      .values({
        ends_at: new Date(now + 24 * 60 * 60_000),
        minimum_entrants: 1,
        month_key: '2026-09',
        name: 'QR Integration Competition',
        region_policy_id: region.id,
        registration_closes_at: new Date(now - 2 * 60 * 60_000),
        registration_opens_at: new Date(now - 48 * 60 * 60_000),
        rules,
        rules_version: 'qr-rules-v1',
        starts_at: new Date(now - 60 * 60_000),
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    competitionId = competition.id;
    await database.connection
      .insertInto('competition_goal_brackets')
      .values({
        competition_id: competition.id,
        created_at: new Date(),
        goal_days: 3,
        label: '3 DAYS / WEEK',
      })
      .execute();
    const verification = await database.connection
      .insertInto('region_verifications')
      .values({
        created_at: new Date(),
        evidence_metadata: { approvedRegion: 'qr-integration-region' },
        expires_at: new Date(now + 24 * 60 * 60_000),
        method: 'device_location',
        policy_version: 'qr-policy-v1',
        region_policy_id: region.id,
        status: 'approved',
        user_id: userId,
        verified_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    regionVerificationId = verification.id;
    const acceptance = await database.connection
      .insertInto('competition_rule_acceptances')
      .values({
        accepted_at: new Date(),
        age_eligibility_attested: true,
        competition_id: competition.id,
        metadata: {},
        rules_version: 'qr-rules-v1',
        user_id: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const enrollment = await database.connection
      .insertInto('competition_enrollments')
      .values({
        competition_id: competition.id,
        enrolled_at: new Date(),
        goal_days: 3,
        region_verification_id: verification.id,
        rules_acceptance_id: acceptance.id,
        status: 'active',
        user_id: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('competition_progress')
      .values({
        category_score: 0,
        competition_id: competition.id,
        enrollment_id: enrollment.id,
        goal_days: 3,
        prize_draw_entries: 1,
        updated_at: new Date(),
        user_id: userId,
        verified_days: 0,
      })
      .execute();
    const gym = await migrated.pool.query<{ id: string }>(
      `INSERT INTO gym_locations
         (region_policy_id, name, address, coordinates, radius_meters)
       VALUES
         ($1, 'Integration Condo Gym', '1 Test Way',
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 75)
       RETURNING id`,
      [region.id, gymLongitude, gymLatitude],
    );
    await database.connection
      .updateTable('competition_enrollments')
      .set({
        gym_credential_version: 1,
        gym_location_id: gym.rows[0].id,
      })
      .where('id', '=', enrollment.id)
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('gym_qr_credentials')
      .values({
        competition_id: competition.id,
        credential_version: 1,
        gym_location_id: gym.rows[0].id,
        issued_at: new Date(),
        issued_by_user_id: userId,
        status: 'active',
        token_hash: hashOpaqueValue(credential),
      })
      .execute();
    await database.connection
      .insertInto('competition_gym_locations')
      .values({
        competition_id: competition.id,
        created_at: new Date(),
        gym_location_id: gym.rows[0].id,
      })
      .execute();
    return gym.rows[0].id;
  }
});
