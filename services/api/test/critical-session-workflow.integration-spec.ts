import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { CompetitionLifecycleService } from '../src/modules/competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../src/modules/competitions/competition-scoring.service';
import { CompetitionsService } from '../src/modules/competitions/competitions.service';
import { hashOpaqueValue } from '../src/modules/gyms/gym-scan-policy';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';
import { hashLegalDocumentContent } from '../src/modules/legal/legal-document';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { ResultsService } from '../src/modules/results/results.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import {
  createTestConfig,
  MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const userPrincipal: AuthenticatedPrincipal = {
  email: 'session-user@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-session-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const unverifiedPrincipal: AuthenticatedPrincipal = {
  email: 'unverified-session-user@integration.test',
  emailVerified: false,
  firebaseUid: 'unverified-critical-session-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const pairingPrincipal: AuthenticatedPrincipal = {
  email: 'weekly-pairing-user@integration.test',
  emailVerified: true,
  firebaseUid: 'weekly-pairing-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const operatorPrincipal: AuthenticatedPrincipal = {
  email: 'session-operator@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-session-operator',
  roles: ['operator'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const cappedUserPrincipals: readonly [
  AuthenticatedPrincipal,
  AuthenticatedPrincipal,
] = [
  {
    email: 'capped-enrollment-a@integration.test',
    emailVerified: true,
    firebaseUid: 'capped-enrollment-user-a',
    roles: ['user'],
    signInProvider: 'password',
    tokenIssuedAt: 1,
  },
  {
    email: 'capped-enrollment-b@integration.test',
    emailVerified: true,
    firebaseUid: 'capped-enrollment-user-b',
    roles: ['user'],
    signInProvider: 'password',
    tokenIssuedAt: 1,
  },
];

const competitionRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 2,
  minSessionMinutes: 10,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: true,
  requirePresenceCheck: true,
  requireGymQr: true,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

interface CompetitionFixture {
  competitionId: string;
  gymPresence: {
    accuracyMeters: number;
    credential: string;
    latitude: number;
    longitude: number;
  };
  legalReceiptBundleId: string;
  regionVerificationId: string;
}

describeWithDatabase('critical session and ledger workflow', () => {
  jest.setTimeout(120_000);

  let competitions: CompetitionsService;
  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let legalDocuments: LegalDocumentsService;
  let operatorUserId: string;
  let profiles: ProfilesService;
  let registrationFixtureSequence = 0;
  let results: ResultsService;
  let sessions: SessionsService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const idempotency = new IdempotencyService(database);
    const ledger = new LedgerService();
    profiles = new ProfilesService(database);
    results = new ResultsService(database, profiles);
    legalDocuments = new LegalDocumentsService(database, idempotency, profiles);
    const scoring = new CompetitionScoringService(database, ledger);
    const lifecycle = new CompetitionLifecycleService(
      database,
      { enqueue: jest.fn() } as unknown as NotificationsService,
      scoring,
    );
    competitions = new CompetitionsService(
      database,
      idempotency,
      ledger,
      legalDocuments,
      profiles,
      lifecycle,
      scoring,
    );
    sessions = new SessionsService(database, idempotency, ledger, profiles);
    const operator = await profiles.ensureUser(
      operatorPrincipal,
      database.connection,
    );
    operatorUserId = operator.id;
    await seedAccountLegalDocuments();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('activates a due contest during the member read without waiting for the worker poll', async () => {
    const fixture = await seedRegistrationCompetition();
    await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'due-start-member-read-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    const dueStartReference = Date.now();
    await migrated.pool.query(
      `UPDATE competitions
       SET minimum_entrants = 1,
           registration_closes_at = $1,
           starts_at = $2
       WHERE id = $3`,
      [
        new Date(dueStartReference - 1_000),
        new Date(dueStartReference - 500),
        fixture.competitionId,
      ],
    );

    await expect(
      competitions.resolveGymQrCompetition(
        userPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toMatchObject({
      id: fixture.competitionId,
      status: 'active',
    });

    const matches = await migrated.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM competition_matches
       WHERE competition_id = $1`,
      [fixture.competitionId],
    );
    expect(Number(matches.rows[0].count)).toBe(4);
  });

  it('instantly pairs the second registrant with a waiting user in the same Weekly Goal', async () => {
    const fixture = await seedRegistrationCompetition();
    const firstUser = await profiles.ensureUser(
      userPrincipal,
      database.connection,
    );
    const secondUser = await profiles.ensureUser(
      pairingPrincipal,
      database.connection,
    );
    const secondLegalReceiptBundleId = await acceptCurrentLegalBundle(
      pairingPrincipal,
      'weekly-pairing-legal-receipt',
    );
    const competition = await database.connection
      .selectFrom('competitions')
      .select('region_policy_id')
      .where('id', '=', fixture.competitionId)
      .executeTakeFirstOrThrow();
    const secondVerification = await database.connection
      .insertInto('region_verifications')
      .values({
        evidence_metadata: {},
        expires_at: new Date(Date.now() + 24 * 60 * 60_000),
        method: 'manual_review',
        policy_version: 'policy-v1',
        region_policy_id: competition.region_policy_id,
        status: 'approved',
        user_id: secondUser.id,
        verified_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const enrollmentRequest = {
      ageEligibilityAttested: true as const,
      goalDays: 3,
      gymPresence: fixture.gymPresence,
      rulesAccepted: true as const,
    };

    await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'weekly-pairing-first-enrollment',
      {
        ...enrollmentRequest,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
      },
    );
    const waitingMatches = await database.connection
      .selectFrom('competition_matches')
      .select(['period_index', 'status', 'user_a_id', 'user_b_id'])
      .where('competition_id', '=', fixture.competitionId)
      .orderBy('period_index')
      .execute();
    expect(waitingMatches).toEqual(
      [1, 2, 3, 4].map((periodIndex) => ({
        period_index: periodIndex,
        status: 'searching',
        user_a_id: firstUser.id,
        user_b_id: null,
      })),
    );

    await competitions.enroll(
      pairingPrincipal,
      fixture.competitionId,
      'weekly-pairing-second-enrollment',
      {
        ...enrollmentRequest,
        legalReceiptBundleId: secondLegalReceiptBundleId,
        regionVerificationId: secondVerification.id,
      },
    );

    const pairedMatches = await database.connection
      .selectFrom('competition_matches')
      .select(['period_index', 'status', 'user_a_id', 'user_b_id'])
      .where('competition_id', '=', fixture.competitionId)
      .orderBy('period_index')
      .execute();
    expect(pairedMatches).toHaveLength(4);
    expect(pairedMatches).toEqual(
      [1, 2, 3, 4].map((periodIndex) => ({
        period_index: periodIndex,
        status: 'matched',
        user_a_id: firstUser.id,
        user_b_id: secondUser.id,
      })),
    );
  });

  it('pins enrollment to the scanned contest when a later contest shares one gym', async () => {
    const fixture = await seedRegistrationCompetition();
    const source = await database.connection
      .selectFrom('competitions as competition')
      .innerJoin(
        'competition_gym_locations as assignment',
        'assignment.competition_id',
        'competition.id',
      )
      .select([
        'assignment.gym_location_id',
        'competition.region_policy_id',
        'competition.registration_opens_at',
        'competition.rules',
        'competition.rules_version',
      ])
      .where('competition.id', '=', fixture.competitionId)
      .executeTakeFirstOrThrow();
    const laterContestStartsAt = new Date(Date.now() + 21 * 24 * 60 * 60_000);
    const laterContestEndsAt = new Date(Date.now() + 28 * 24 * 60 * 60_000);
    const otherCompetition = await database.connection
      .insertInto('competitions')
      .values({
        ends_at: laterContestEndsAt,
        minimum_entrants: 1,
        month_key: '2030-02',
        name: 'Later Contest At Same Gym',
        region_policy_id: source.region_policy_id,
        registration_closes_at: new Date(Date.now() + 20 * 24 * 60 * 60_000),
        registration_opens_at: source.registration_opens_at,
        rules: source.rules,
        rules_version: source.rules_version,
        starts_at: laterContestStartsAt,
        status: 'registration',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('competition_goal_brackets')
      .values({
        competition_id: otherCompetition.id,
        created_at: new Date(),
        goal_days: 3,
        label: 'Three days',
      })
      .execute();
    await database.connection
      .insertInto('competition_gym_locations')
      .values({
        competition_id: otherCompetition.id,
        created_at: new Date(),
        gym_location_id: source.gym_location_id,
      })
      .execute();
    const otherCredential =
      'different-contest-same-gym-credential-000000000001';
    const latestCredential = await database.connection
      .selectFrom('gym_qr_credentials')
      .select((expression) =>
        expression.fn.max<number>('credential_version').as('version'),
      )
      .where('gym_location_id', '=', source.gym_location_id)
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('gym_qr_credentials')
      .values({
        competition_id: otherCompetition.id,
        credential_version: Number(latestCredential.version ?? 0) + 1,
        gym_location_id: source.gym_location_id,
        issued_by_user_id: operatorUserId,
        qr_payload: `https://app.gogymgo.com/scan?credential=${otherCredential}`,
        status: 'active',
        token_hash: hashOpaqueValue(otherCredential),
      })
      .execute();

    await expect(
      competitions.resolveGymQrCompetition(userPrincipal, otherCredential),
    ).resolves.toMatchObject({
      id: otherCompetition.id,
      name: 'Later Contest At Same Gym',
    });
    await expect(
      competitions.resolveGymQrCompetition(
        userPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toMatchObject({ id: fixture.competitionId });
    await expect(
      competitions.enroll(
        userPrincipal,
        otherCompetition.id,
        'wrong-contest-poster-enrollment',
        {
          ageEligibilityAttested: true,
          goalDays: 3,
          gymPresence: fixture.gymPresence,
          legalReceiptBundleId: fixture.legalReceiptBundleId,
          regionVerificationId: fixture.regionVerificationId,
          rulesAccepted: true,
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'GYM_QR_INVALID' },
    });

    await competitions.enroll(
      userPrincipal,
      otherCompetition.id,
      'existing-later-contest-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: {
          ...fixture.gymPresence,
          credential: otherCredential,
        },
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    await expect(competitions.getCurrent(userPrincipal)).resolves.toMatchObject(
      {
        id: otherCompetition.id,
      },
    );
    await expect(
      competitions.resolveGymQrCompetition(
        userPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toMatchObject({ id: fixture.competitionId });

    await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'scanned-earlier-contest-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    await expect(
      competitions.getCurrentEnrollment(userPrincipal, fixture.competitionId),
    ).resolves.toMatchObject({ competitionId: fixture.competitionId });

    const activeEnrollment = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id
       FROM competition_enrollments
       WHERE competition_id = $1 AND status = 'active'`,
      [fixture.competitionId],
    );
    const activeSession = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at)
       VALUES ($1, $2, $3, CURRENT_DATE, 'active', 'rules-v1', CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        fixture.competitionId,
        activeEnrollment.rows[0].id,
        activeEnrollment.rows[0].user_id,
      ],
    );
    await expect(
      competitions.withdrawEnrollment(
        userPrincipal,
        fixture.competitionId,
        'withdraw-scanned-earlier-contest',
      ),
    ).resolves.toMatchObject({
      competitionId: fixture.competitionId,
      status: 'withdrawn',
    });
    await expect(
      competitions.getCurrentEnrollment(userPrincipal, fixture.competitionId),
    ).resolves.toBeNull();
    const cancelledSession = await migrated.pool.query<{ status: string }>(
      `SELECT status FROM workout_sessions WHERE id = $1`,
      [activeSession.rows[0].id],
    );
    expect(cancelledSession.rows[0].status).toBe('cancelled');
  });

  it('enforces registration open and close times for QR resolution and enrollment', async () => {
    const fixture = await seedRegistrationCompetition();
    const now = Date.now();
    await migrated.pool.query(
      `UPDATE competitions
       SET registration_opens_at = $1,
           registration_closes_at = $2,
           starts_at = $3,
           ends_at = $4
       WHERE id = $5`,
      [
        new Date(now + 30 * 60_000),
        new Date(now + 60 * 60_000),
        new Date(now + 90 * 60_000),
        new Date(now + 120 * 60_000),
        fixture.competitionId,
      ],
    );

    await expect(
      competitions.resolveGymQrCompetition(
        userPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toBeNull();
    await expect(
      competitions.enroll(
        userPrincipal,
        fixture.competitionId,
        'registration-window-not-open',
        {
          ageEligibilityAttested: true,
          goalDays: 3,
          gymPresence: fixture.gymPresence,
          legalReceiptBundleId: fixture.legalReceiptBundleId,
          regionVerificationId: fixture.regionVerificationId,
          rulesAccepted: true,
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPETITION_REGISTRATION_NOT_OPEN' },
    });

    await migrated.pool.query(
      `UPDATE competitions
       SET registration_opens_at = $1,
           registration_closes_at = $2,
           starts_at = $3,
           ends_at = $4
       WHERE id = $5`,
      [
        new Date(now - 60 * 60_000),
        new Date(now - 30 * 60_000),
        new Date(now + 30 * 60_000),
        new Date(now + 60 * 60_000),
        fixture.competitionId,
      ],
    );

    await expect(
      competitions.resolveGymQrCompetition(
        userPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toBeNull();
    await expect(
      competitions.enroll(
        userPrincipal,
        fixture.competitionId,
        'registration-window-closed',
        {
          ageEligibilityAttested: true,
          goalDays: 3,
          gymPresence: fixture.gymPresence,
          legalReceiptBundleId: fixture.legalReceiptBundleId,
          regionVerificationId: fixture.regionVerificationId,
          rulesAccepted: true,
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPETITION_REGISTRATION_CLOSED' },
    });
  });

  it("returns pending and then exact settled results for the participant's ended contest", async () => {
    const fixture = await seedRegistrationCompetition();
    await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'participant-results-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    await migrated.pool.query(
      `UPDATE competitions
       SET status = 'active',
           registration_opens_at = $1,
           registration_closes_at = $2,
           starts_at = $3,
           ends_at = $4
       WHERE id = $5`,
      [
        new Date(Date.now() - 90 * 60_000),
        new Date(Date.now() - 70 * 60_000),
        new Date(Date.now() - 60 * 60_000),
        new Date(Date.now() - 16 * 60_000),
        fixture.competitionId,
      ],
    );

    await expect(
      results.getLatestParticipantResults(userPrincipal),
    ).resolves.toMatchObject({
      categoryLeaderboards: [],
      competitionId: fixture.competitionId,
      participantGoalDays: 3,
      resultsStatus: 'pending',
      rewardWinners: [],
      settledAt: null,
    });

    const user = await profiles.ensureUser(userPrincipal, database.connection);
    await profiles.getMe(userPrincipal);
    await migrated.pool.query(
      `UPDATE competition_progress
       SET category_score = 7, verified_days = 1
       WHERE competition_id = $1 AND user_id = $2`,
      [fixture.competitionId, user.id],
    );
    const reward = await migrated.pool.query<{ id: string }>(
      `INSERT INTO reward_catalog_items
         (competition_id, sponsor_name, title, description, reward_type,
          status, inventory_total, display_order, version,
          fulfillment_instructions)
       VALUES ($1, 'GoGymGo', '$200 Cash', 'Participant result test reward',
               'cash', 'published', 1, 1, 1, 'Contact GoGymGo to claim.')
       RETURNING id`,
      [fixture.competitionId],
    );
    const draw = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competition_draws
         (competition_id, status, rules_version, seed_commitment, seed_reveal,
          entrant_snapshot_hash, entrant_count, total_entries, locked_at,
          settled_at)
       VALUES ($1, 'settled', 'rules-v1', repeat('a', 64), repeat('b', 64),
               repeat('c', 64), 1, 5, $2, $2)
       RETURNING id`,
      [fixture.competitionId, new Date()],
    );
    await migrated.pool.query(
      `INSERT INTO reward_awards
         (draw_id, reward_catalog_item_id, user_id, award_rank, status,
          awarded_at, updated_at)
       VALUES ($1, $2, $3, 1, 'awarded', $4, $4)`,
      [draw.rows[0].id, reward.rows[0].id, user.id, new Date()],
    );
    await migrated.pool.query(
      `UPDATE competitions SET status = 'settled' WHERE id = $1`,
      [fixture.competitionId],
    );

    await expect(
      results.getLatestParticipantResults(userPrincipal),
    ).resolves.toMatchObject({
      categoryLeaderboards: [
        {
          goal: 3,
          rows: [
            {
              categoryEntries: 7,
              rank: 1,
              verifiedDays: 1,
            },
          ],
        },
      ],
      competitionId: fixture.competitionId,
      participantGoalDays: 3,
      resultsStatus: 'settled',
      rewardCount: 1,
      rewardWinners: [
        {
          awardRank: 1,
          rewardTitle: '$200 Cash',
          rewardType: 'cash',
          sponsorName: 'GoGymGo',
        },
      ],
      settledAt: expect.any(String),
    });
  });

  it('accepts evidence once and awards the verified day exactly once', async () => {
    const fixture = await seedRegistrationCompetition();
    await expect(
      competitions.enroll(
        unverifiedPrincipal,
        fixture.competitionId,
        'unverified-session-workflow-enrollment',
        {
          ageEligibilityAttested: true,
          goalDays: 3,
          gymPresence: fixture.gymPresence,
          legalReceiptBundleId: fixture.legalReceiptBundleId,
          regionVerificationId: fixture.regionVerificationId,
          rulesAccepted: true,
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'VERIFIED_EMAIL_REQUIRED' },
    });
    await expect(
      competitions.enroll(
        userPrincipal,
        fixture.competitionId,
        'session-workflow-outside-gym',
        {
          ageEligibilityAttested: true,
          goalDays: 3,
          gymPresence: {
            ...fixture.gymPresence,
            latitude: fixture.gymPresence.latitude + 0.01,
          },
          legalReceiptBundleId: fixture.legalReceiptBundleId,
          regionVerificationId: fixture.regionVerificationId,
          rulesAccepted: true,
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'OUTSIDE_GYM_GEOFENCE' },
    });
    const enrollment = await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'session-workflow-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    await expect(
      competitions.enroll(
        userPrincipal,
        fixture.competitionId,
        'session-workflow-enrollment',
        {
          ageEligibilityAttested: true,
          goalDays: 3,
          gymPresence: fixture.gymPresence,
          legalReceiptBundleId: fixture.legalReceiptBundleId,
          regionVerificationId: fixture.regionVerificationId,
          rulesAccepted: true,
        },
      ),
    ).resolves.toEqual(enrollment);
    await activateCompetition(fixture.competitionId);

    const abandoned = await sessions.create(
      userPrincipal,
      'session-workflow-abandoned-create',
      { competitionId: fixture.competitionId },
    );
    const cancelled = await sessions.cancel(
      userPrincipal,
      abandoned.id,
      'session-workflow-abandoned-cancel',
    );
    expect(cancelled).toMatchObject({
      completedAt: expect.any(String),
      id: abandoned.id,
      status: 'cancelled',
    });
    await expect(
      sessions.cancel(
        userPrincipal,
        abandoned.id,
        'session-workflow-abandoned-cancel',
      ),
    ).resolves.toEqual(cancelled);

    const created = await sessions.create(
      userPrincipal,
      'session-workflow-create',
      { competitionId: fixture.competitionId },
    );
    expect(created.requirements).toEqual({
      minHeartRateSamples: competitionRules.minHeartRateSamples,
      minSessionMinutes: competitionRules.minSessionMinutes,
      requireDeviceAttestation: competitionRules.requireDeviceAttestation,
      requireGymQr: competitionRules.requireGymQr,
      requirePresenceCheck: competitionRules.requirePresenceCheck,
    });
    await expect(
      sessions.create(userPrincipal, 'session-workflow-create', {
        competitionId: fixture.competitionId,
      }),
    ).resolves.toEqual(created);
    await backdateSession(created.id);

    const evidenceTimes = buildEvidenceTimes();
    await sessions.appendEvent(
      userPrincipal,
      created.id,
      'session-heart-rate-one',
      {
        eventId: '10000000-0000-4000-8000-000000000001',
        eventType: 'heart_rate_sample',
        heartRateBpm: 132,
        occurredAt: evidenceTimes[0],
      },
    );
    await sessions.appendEvent(
      userPrincipal,
      created.id,
      'session-heart-rate-two',
      {
        eventId: '10000000-0000-4000-8000-000000000002',
        eventType: 'heart_rate_sample',
        heartRateBpm: 141,
        occurredAt: evidenceTimes[1],
      },
    );
    await sessions.appendEvent(
      userPrincipal,
      created.id,
      'session-presence-check',
      {
        eventId: '10000000-0000-4000-8000-000000000003',
        eventType: 'presence_check',
        occurredAt: evidenceTimes[2],
      },
    );
    const qrEvent = {
      eventId: '10000000-0000-4000-8000-000000000004',
      eventType: 'gym_qr_scan' as const,
      occurredAt: evidenceTimes[3],
      qrPayload: 'signed-gym-credential',
    };
    const storedQr = await sessions.appendEvent(
      userPrincipal,
      created.id,
      'session-gym-qr',
      qrEvent,
    );
    await expect(
      sessions.appendEvent(
        userPrincipal,
        created.id,
        'session-gym-qr',
        qrEvent,
      ),
    ).resolves.toEqual(storedQr);
    await expect(
      sessions.appendEvent(userPrincipal, created.id, 'session-gym-qr', {
        ...qrEvent,
        qrPayload: 'changed-gym-credential',
      }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    await expect(
      sessions.appendEvent(
        userPrincipal,
        created.id,
        'session-gym-qr-replayed',
        { ...qrEvent, qrPayload: 'changed-gym-credential' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'SESSION_EVENT_REPLAY_MISMATCH' },
    });
    await sessions.appendEvent(
      userPrincipal,
      created.id,
      'session-device-attestation',
      {
        deviceEvidenceToken: 'signed-device-attestation',
        eventId: '10000000-0000-4000-8000-000000000005',
        eventType: 'device_attestation',
        occurredAt: evidenceTimes[4],
      },
    );

    const completed = await sessions.complete(
      userPrincipal,
      created.id,
      'session-workflow-complete',
      {},
    );
    expect(completed).toMatchObject({
      eligibleForReview: true,
      status: 'pending_review',
      violations: [],
    });
    await expect(
      sessions.complete(
        userPrincipal,
        created.id,
        'session-workflow-complete',
        {},
      ),
    ).resolves.toEqual(completed);

    await migrated.pool.query(
      `UPDATE users SET email_verified = false WHERE firebase_uid = $1`,
      [userPrincipal.firebaseUid],
    );
    await expect(
      verifySession(created.id, 'verify-unverified-session'),
    ).rejects.toMatchObject({
      response: { code: 'VERIFIED_EMAIL_REQUIRED' },
    });
    await expect(verifiedLedgerCount(created.id)).resolves.toBe(0);
    await migrated.pool.query(
      `UPDATE users SET email_verified = true WHERE firebase_uid = $1`,
      [userPrincipal.firebaseUid],
    );

    await migrated.pool.query(
      `UPDATE competition_enrollments
       SET status = 'disqualified'
       WHERE id = $1`,
      [enrollment.id],
    );
    await expect(
      verifySession(created.id, 'verify-disqualified-session'),
    ).rejects.toMatchObject({
      response: { code: 'ACTIVE_ENROLLMENT_REQUIRED' },
    });
    await expect(verifiedLedgerCount(created.id)).resolves.toBe(0);

    await migrated.pool.query(
      `UPDATE competition_enrollments
       SET status = 'active'
       WHERE id = $1`,
      [enrollment.id],
    );
    const evidenceReview = await sessions.getEvidenceReview(created.id);
    expect(evidenceReview).toMatchObject({
      evidence: {
        deviceAttestation: { count: 1, required: true },
        gymQr: { count: 1, required: true, uniquePayloadCount: 1 },
        heartRate: { count: 2, required: true },
        presenceCheck: { count: 1, required: true },
      },
      status: 'pending_review',
    });
    expect(JSON.stringify(evidenceReview)).not.toContain(
      'signed-gym-credential',
    );
    await expect(
      verifySession(created.id, 'verify-stale-session', '0'.repeat(64)),
    ).rejects.toMatchObject({
      response: { code: 'SESSION_REVIEW_SNAPSHOT_STALE' },
    });
    await expect(
      sessions.verifySession({
        evidenceSnapshotSha256: evidenceReview.evidenceSnapshotSha256,
        findings: {
          deviceAttestation: 'approved',
          gymQr: 'approved',
          heartRate: 'approved',
          presenceCheck: 'rejected',
        },
        operatorUserId,
        reason: 'required evidence rejection integration test',
        requestId: 'verify-rejected-evidence',
        sessionId: created.id,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SESSION_REQUIRED_EVIDENCE_NOT_APPROVED' },
    });
    await expect(verifiedLedgerCount(created.id)).resolves.toBe(0);
    await expect(verifySession(created.id, 'verify-session')).resolves.toBe(
      true,
    );
    await expect(
      verifySession(
        created.id,
        'verify-session-retry',
        evidenceReview.evidenceSnapshotSha256,
      ),
    ).resolves.toBe(false);

    const progress = await migrated.pool.query<{
      category_score: number;
      prize_draw_entries: number;
      verified_days: number;
    }>(
      `SELECT category_score, prize_draw_entries, verified_days
       FROM competition_progress
       WHERE competition_id = $1 AND enrollment_id = $2`,
      [fixture.competitionId, enrollment.id],
    );
    expect(progress.rows[0]).toEqual({
      category_score: 1,
      prize_draw_entries: 2,
      verified_days: 1,
    });
    await expect(verifiedLedgerCount(created.id)).resolves.toBe(1);

    const storedEvidence = await migrated.pool.query<{
      event_count: string;
      payloads: string;
    }>(
      `SELECT count(*)::text AS event_count,
              string_agg(payload::text, ' ') AS payloads
       FROM session_events
       WHERE session_id = $1`,
      [created.id],
    );
    expect(storedEvidence.rows[0].event_count).toBe('5');
    expect(storedEvidence.rows[0].payloads).not.toContain(
      'signed-gym-credential',
    );
    expect(storedEvidence.rows[0].payloads).not.toContain(
      'changed-gym-credential',
    );
    expect(storedEvidence.rows[0].payloads).not.toContain(
      'signed-device-attestation',
    );

    const duplicateDay = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, completed_at)
       SELECT competition_id, enrollment_id, user_id, eligible_date,
              'pending_review', policy_version, started_at, completed_at
       FROM workout_sessions
       WHERE id = $1
       RETURNING id`,
      [created.id],
    );
    await expect(
      verifySession(duplicateDay.rows[0].id, 'verify-duplicate-day'),
    ).rejects.toMatchObject({
      response: { code: 'VERIFIED_DAY_ALREADY_AWARDED' },
    });
    const duplicateReview = await sessions.getEvidenceReview(
      duplicateDay.rows[0].id,
    );
    await expect(
      sessions.rejectSession({
        evidenceSnapshotSha256: duplicateReview.evidenceSnapshotSha256,
        findings: {
          deviceAttestation: 'not_required',
          gymQr: 'not_required',
          heartRate: 'not_required',
          presenceCheck: 'not_required',
        },
        operatorUserId,
        reason: 'rejection requires a failed evidence finding',
        requestId: 'reject-duplicate-without-finding',
        sessionId: duplicateDay.rows[0].id,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SESSION_REJECTION_FINDING_REQUIRED' },
    });
    await expect(
      rejectSession(
        duplicateDay.rows[0].id,
        duplicateReview.evidenceSnapshotSha256,
        'reject-duplicate-day',
      ),
    ).resolves.toBe(true);
    await expect(
      rejectSession(
        duplicateDay.rows[0].id,
        duplicateReview.evidenceSnapshotSha256,
        'reject-duplicate-day-retry',
      ),
    ).resolves.toBe(false);
    const rejection = await migrated.pool.query<{
      audit_count: number;
      outcome: string;
      pending_count: number;
      status: string;
    }>(
      `SELECT session.status,
              session.verification_summary->>'outcome' AS outcome,
              (SELECT count(*)::integer
               FROM operator_audit_events
               WHERE action = 'session.rejected'
                 AND entity_id = session.id) AS audit_count,
              (SELECT count(*)::integer
               FROM workout_sessions
               WHERE competition_id = session.competition_id
                 AND status IN ('active', 'pending_review')) AS pending_count
       FROM workout_sessions AS session
       WHERE session.id = $1`,
      [duplicateDay.rows[0].id],
    );
    expect(rejection.rows[0]).toEqual({
      audit_count: 1,
      outcome: 'rejected',
      pending_count: 0,
      status: 'rejected',
    });
    await expect(verifiedLedgerCount(duplicateDay.rows[0].id)).resolves.toBe(0);
    await expect(verifiedLedgerCount(created.id)).resolves.toBe(1);
  });

  it('serializes entrant caps and never resurrects inactive enrollments', async () => {
    const fixture = await seedCappedCompetition();
    const outcomes = await Promise.allSettled(
      fixture.users.map((user, index) =>
        competitions.enroll(
          user.principal,
          fixture.competitionId,
          `capped-enrollment-${index + 1}`,
          {
            ageEligibilityAttested: true,
            goalDays: 3,
            gymPresence: fixture.gymPresence,
            legalReceiptBundleId: user.legalReceiptBundleId,
            regionVerificationId: user.regionVerificationId,
            rulesAccepted: true,
          },
        ),
      ),
    );
    const successful = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled',
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === 'rejected',
    );
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      response: { code: 'COMPETITION_FULL' },
    });

    const winnerIndex = outcomes.findIndex(
      (outcome) => outcome.status === 'fulfilled',
    );
    const winner = fixture.users[winnerIndex];
    const enrollment = (
      outcomes[winnerIndex] as PromiseFulfilledResult<{
        competitionId: string;
        enrolledAt: string;
        goalDays: number;
        id: string;
        status: 'active';
      }>
    ).value;
    const originalRequest = {
      ageEligibilityAttested: true as const,
      goalDays: 3,
      gymPresence: fixture.gymPresence,
      legalReceiptBundleId: winner.legalReceiptBundleId,
      regionVerificationId: winner.regionVerificationId,
      rulesAccepted: true as const,
    };
    await expect(
      competitions.enroll(
        winner.principal,
        fixture.competitionId,
        'capped-enrollment-resource-retry',
        originalRequest,
      ),
    ).resolves.toEqual(enrollment);
    await expect(
      competitions.enroll(
        winner.principal,
        fixture.competitionId,
        'capped-enrollment-details-conflict',
        { ...originalRequest, goalDays: 4 },
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPETITION_ENROLLMENT_ALREADY_EXISTS' },
    });

    await migrated.pool.query(
      `UPDATE competition_enrollments
       SET status = 'disqualified'
       WHERE id = $1`,
      [enrollment.id],
    );
    await expect(
      competitions.enroll(
        winner.principal,
        fixture.competitionId,
        'capped-enrollment-inactive-conflict',
        originalRequest,
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPETITION_ENROLLMENT_INACTIVE' },
    });

    const counts = await migrated.pool.query<{
      acceptances: number;
      enrollments: number;
      ledger_entries: number;
    }>(
      `SELECT
         (SELECT count(*)::integer
          FROM competition_enrollments
          WHERE competition_id = $1) AS enrollments,
         (SELECT count(*)::integer
          FROM competition_rule_acceptances
          WHERE competition_id = $1) AS acceptances,
         (SELECT count(*)::integer
          FROM entry_ledger
          WHERE competition_id = $1 AND reason = 'enrollment') AS ledger_entries`,
      [fixture.competitionId],
    );
    expect(counts.rows[0]).toEqual({
      acceptances: 100,
      enrollments: 100,
      ledger_entries: 1,
    });
  });

  async function verifySession(
    sessionId: string,
    requestId: string,
    evidenceSnapshotSha256?: string,
  ) {
    const resolvedSnapshotSha256 =
      evidenceSnapshotSha256 ??
      (await sessions.getEvidenceReview(sessionId)).evidenceSnapshotSha256;
    return sessions.verifySession({
      evidenceSnapshotSha256: resolvedSnapshotSha256,
      findings: {
        deviceAttestation: 'approved',
        gymQr: 'approved',
        heartRate: 'approved',
        presenceCheck: 'approved',
      },
      operatorUserId,
      reason: 'trusted evidence reviewed in integration test',
      requestId,
      sessionId,
    });
  }

  function rejectSession(
    sessionId: string,
    evidenceSnapshotSha256: string,
    requestId: string,
  ) {
    return sessions.rejectSession({
      evidenceSnapshotSha256,
      findings: {
        deviceAttestation: 'not_required',
        gymQr: 'not_required',
        heartRate: 'not_required',
        presenceCheck: 'rejected',
      },
      operatorUserId,
      reason: 'evidence failed operator review in integration test',
      requestId,
      sessionId,
    });
  }

  async function verifiedLedgerCount(sourceEventId: string): Promise<number> {
    const result = await migrated.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM entry_ledger
       WHERE source_event_id = $1 AND reason = 'verified_session'`,
      [sourceEventId],
    );
    return Number(result.rows[0].count);
  }

  async function seedRegistrationCompetition(): Promise<CompetitionFixture> {
    const now = Date.now();
    const fixtureSequence = ++registrationFixtureSequence;
    const user = await profiles.ensureUser(userPrincipal, database.connection);
    const legalReceiptBundleId = await acceptCurrentLegalBundle(
      userPrincipal,
      'critical-session-legal-receipt',
    );
    const region = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
           boundary_version, policy_version, boundary, valid_from)
       VALUES
         ($2, 'CA', 'BC', 'Critical Session Region',
           'CAD', 'America/Vancouver', ARRAY['en-CA'], 19, TRUE,
          'boundary-v1', 'policy-v1',
          ST_GeogFromText(
            'SRID=4326;MULTIPOLYGON(((-123.5 49.0,-122.8 49.0,-122.8 49.6,-123.5 49.6,-123.5 49.0)))'
          ),
          $1)
       RETURNING id`,
      [
        new Date(now - 24 * 60 * 60_000),
        `critical-session-region-${fixtureSequence}`,
      ],
    );
    const verification = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_verifications
         (user_id, region_policy_id, method, status, evidence_metadata,
          policy_version, verified_at, expires_at)
       VALUES ($1, $2, 'manual_review', 'approved', '{}'::jsonb,
               'policy-v1', $3, $4)
       RETURNING id`,
      [
        user.id,
        region.rows[0].id,
        new Date(now - 60_000),
        new Date(now + 24 * 60 * 60_000),
      ],
    );
    const competition = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, status, rules_version,
          rules, minimum_entrants, registration_opens_at,
          registration_closes_at, starts_at, ends_at)
       VALUES ($1, '2030-01', 'Critical Session Competition', 'registration',
               'rules-v1', $2::jsonb, 100, $3, $4, $5, $6)
       RETURNING id`,
      [
        region.rows[0].id,
        JSON.stringify(competitionRules),
        new Date(now - 60 * 60_000),
        new Date(now + 60 * 60_000),
        new Date(now + 2 * 60 * 60_000),
        new Date(now + 24 * 60 * 60_000),
      ],
    );
    await migrated.pool.query(
      `INSERT INTO competition_goal_brackets
         (competition_id, goal_days, label)
       VALUES ($1, 3, 'Three days')`,
      [competition.rows[0].id],
    );
    const gymCredential = `critical-session-gym-credential-${fixtureSequence
      .toString()
      .padStart(8, '0')}`;
    const gym = await migrated.pool.query<{ id: string }>(
      `INSERT INTO gym_locations
         (region_policy_id, name, address, coordinates, radius_meters, active)
       VALUES ($1, 'Critical Session Gym', '100 Test Street',
               ST_SetSRID(ST_MakePoint(-123.1207, 49.2827), 4326)::geography,
               75, TRUE)
       RETURNING id`,
      [region.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO gym_qr_credentials
         (competition_id, gym_location_id, credential_version, token_hash, status, issued_by_user_id)
       VALUES ($1, $2, 1, $3, 'active', $4)`,
      [
        competition.rows[0].id,
        gym.rows[0].id,
        hashOpaqueValue(gymCredential),
        operatorUserId,
      ],
    );
    await migrated.pool.query(
      `INSERT INTO competition_gym_locations (competition_id, gym_location_id)
       VALUES ($1, $2)`,
      [competition.rows[0].id, gym.rows[0].id],
    );
    return {
      competitionId: competition.rows[0].id,
      gymPresence: {
        accuracyMeters: 5,
        credential: gymCredential,
        latitude: 49.2827,
        longitude: -123.1207,
      },
      legalReceiptBundleId,
      regionVerificationId: verification.rows[0].id,
    };
  }

  async function seedCappedCompetition(): Promise<{
    competitionId: string;
    gymPresence: CompetitionFixture['gymPresence'];
    users: readonly [
      {
        legalReceiptBundleId: string;
        principal: AuthenticatedPrincipal;
        regionVerificationId: string;
      },
      {
        legalReceiptBundleId: string;
        principal: AuthenticatedPrincipal;
        regionVerificationId: string;
      },
    ];
  }> {
    const now = Date.now();
    const region = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
           boundary_version, policy_version, boundary, valid_from)
       VALUES
         ('critical-capped-enrollment-region', 'CA', 'BC',
          'Critical Capped Enrollment Region', 'CAD', 'America/Vancouver',
           ARRAY['en-CA'], 19, TRUE, 'boundary-v1', 'policy-v1',
           ST_GeogFromText(
             'SRID=4326;MULTIPOLYGON(((-123.5 49.0,-122.8 49.0,-122.8 49.6,-123.5 49.6,-123.5 49.0)))'
           ),
           $1)
       RETURNING id`,
      [new Date(now - 24 * 60 * 60_000)],
    );
    const users = [] as Array<{
      legalReceiptBundleId: string;
      principal: AuthenticatedPrincipal;
      regionVerificationId: string;
    }>;
    for (const principal of cappedUserPrincipals) {
      const user = await profiles.ensureUser(principal, database.connection);
      const legalReceiptBundleId = await acceptCurrentLegalBundle(
        principal,
        `critical-capped-legal-${principal.firebaseUid}`,
      );
      const verification = await migrated.pool.query<{ id: string }>(
        `INSERT INTO region_verifications
           (user_id, region_policy_id, method, status, evidence_metadata,
            policy_version, verified_at, expires_at)
         VALUES ($1, $2, 'manual_review', 'approved', '{}'::jsonb,
                 'policy-v1', $3, $4)
         RETURNING id`,
        [
          user.id,
          region.rows[0].id,
          new Date(now - 60_000),
          new Date(now + 24 * 60 * 60_000),
        ],
      );
      users.push({
        legalReceiptBundleId,
        principal,
        regionVerificationId: verification.rows[0].id,
      });
    }
    const competition = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, status, rules_version,
          rules, minimum_entrants, entrant_cap, registration_opens_at,
          registration_closes_at, starts_at, ends_at)
       VALUES ($1, '2030-02', 'Critical Capped Enrollment Competition',
               'registration', 'rules-v1', $2::jsonb, 100, 100,
               $3, $4, $5, $6)
       RETURNING id`,
      [
        region.rows[0].id,
        JSON.stringify(competitionRules),
        new Date(now - 60 * 60_000),
        new Date(now + 60 * 60_000),
        new Date(now + 2 * 60 * 60_000),
        new Date(now + 24 * 60 * 60_000),
      ],
    );
    await migrated.pool.query(
      `INSERT INTO competition_goal_brackets
         (competition_id, goal_days, label)
       VALUES ($1, 3, 'Three days'), ($1, 4, 'Four days')`,
      [competition.rows[0].id],
    );
    const gymCredential = 'critical-capped-gym-credential-000000001';
    const gym = await migrated.pool.query<{ id: string }>(
      `INSERT INTO gym_locations
         (region_policy_id, name, address, coordinates, radius_meters, active)
       VALUES ($1, 'Critical Capped Gym', '200 Test Street',
               ST_SetSRID(ST_MakePoint(-123.1207, 49.2827), 4326)::geography,
               75, TRUE)
       RETURNING id`,
      [region.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO gym_qr_credentials
         (competition_id, gym_location_id, credential_version, token_hash, status, issued_by_user_id)
       VALUES ($1, $2, 1, $3, 'active', $4)`,
      [
        competition.rows[0].id,
        gym.rows[0].id,
        hashOpaqueValue(gymCredential),
        operatorUserId,
      ],
    );
    await migrated.pool.query(
      `INSERT INTO competition_gym_locations (competition_id, gym_location_id)
       VALUES ($1, $2)`,
      [competition.rows[0].id, gym.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO users (firebase_uid, email_verified)
       SELECT 'capped-seeded-user-' || sequence::text, TRUE
       FROM generate_series(1, 99) AS sequence`,
    );
    await migrated.pool.query(
      `INSERT INTO region_verifications
         (user_id, region_policy_id, method, status, evidence_metadata,
          policy_version, verified_at)
       SELECT id, $1, 'manual_review', 'approved', '{}'::jsonb,
              'policy-v1', current_timestamp
       FROM users
       WHERE firebase_uid LIKE 'capped-seeded-user-%'`,
      [region.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO competition_rule_acceptances
         (competition_id, user_id, rules_version, age_eligibility_attested)
       SELECT $1, id, 'rules-v1', TRUE
       FROM users
       WHERE firebase_uid LIKE 'capped-seeded-user-%'`,
      [competition.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO competition_enrollments
         (competition_id, user_id, goal_days, region_verification_id,
          rules_acceptance_id, status)
       SELECT $1, user_account.id, 3, verification.id, acceptance.id, 'active'
       FROM users AS user_account
       INNER JOIN region_verifications AS verification
         ON verification.user_id = user_account.id
        AND verification.region_policy_id = $2
       INNER JOIN competition_rule_acceptances AS acceptance
         ON acceptance.user_id = user_account.id
        AND acceptance.competition_id = $1
       WHERE user_account.firebase_uid LIKE 'capped-seeded-user-%'`,
      [competition.rows[0].id, region.rows[0].id],
    );
    return {
      competitionId: competition.rows[0].id,
      gymPresence: {
        accuracyMeters: 5,
        credential: gymCredential,
        latitude: 49.2827,
        longitude: -123.1207,
      },
      users: users as [
        {
          legalReceiptBundleId: string;
          principal: AuthenticatedPrincipal;
          regionVerificationId: string;
        },
        {
          legalReceiptBundleId: string;
          principal: AuthenticatedPrincipal;
          regionVerificationId: string;
        },
      ],
    };
  }

  async function seedAccountLegalDocuments(): Promise<void> {
    const effectiveAt = new Date(Date.now() - 60_000);
    for (const document of [
      {
        documentKey: 'privacy_policy',
        receiptRequirement: 'acknowledge' as const,
        title: 'Privacy Policy',
      },
      {
        documentKey: 'terms_of_service',
        receiptRequirement: 'accept' as const,
        title: 'Terms of Service',
      },
    ]) {
      const content = {
        intro: `${document.title} integration fixture`,
        sections: [{ body: 'Fixture body', heading: 'Fixture section' }],
      };
      const inserted = await database.connection
        .insertInto('legal_documents')
        .values({
          content,
          content_sha256: hashLegalDocumentContent(document.title, content),
          created_at: effectiveAt,
          document_key: document.documentKey,
          effective_at: effectiveAt,
          jurisdiction_code: 'GLOBAL',
          locale: 'en-CA',
          owner_approved_at: effectiveAt,
          owner_approved_by_user_id: operatorUserId,
          receipt_requirement: document.receiptRequirement,
          title: document.title,
          version: 'integration-v1',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await database.connection
        .insertInto('legal_document_events')
        .values({
          actor_user_id: operatorUserId,
          created_at: effectiveAt,
          legal_document_id: inserted.id,
          next_state: 'published',
          previous_state: null,
          reason: 'Integration fixture publication',
          request_id: `fixture-${document.documentKey}`,
        })
        .executeTakeFirstOrThrow();
    }
  }

  async function acceptCurrentLegalBundle(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
  ): Promise<string> {
    const current = await legalDocuments.getCurrent({
      jurisdictionCode: 'CA-BC',
      locale: 'en-CA',
    });
    const status = await legalDocuments.recordReceiptBundle(
      principal,
      idempotencyKey,
      {
        bundleSha256: current.bundleSha256,
        documents: current.documents
          .filter((document) => document.receiptRequirement !== 'none')
          .map((document) => ({
            action: document.receiptRequirement as 'accept' | 'acknowledge',
            contentSha256: document.contentSha256,
            documentId: document.id,
          })),
        jurisdictionCode: 'CA-BC',
        locale: 'en-CA',
      },
    );
    return status.receiptBundleId!;
  }

  async function activateCompetition(competitionId: string): Promise<void> {
    const now = Date.now();
    await migrated.pool.query(
      `UPDATE competitions
       SET status = 'active',
           registration_closes_at = $2,
           starts_at = $3,
           ends_at = $4,
           updated_at = $1
       WHERE id = $5`,
      [
        new Date(now),
        new Date(now - 30 * 60_000),
        new Date(now - 20 * 60_000),
        new Date(now + 24 * 60 * 60_000),
        competitionId,
      ],
    );
  }

  async function backdateSession(sessionId: string): Promise<void> {
    await migrated.pool.query(
      `UPDATE workout_sessions
       SET started_at = $1, updated_at = $1
       WHERE id = $2`,
      [new Date(Date.now() - 11 * 60_000), sessionId],
    );
  }

  function buildEvidenceTimes(): [string, string, string, string, string] {
    const now = Date.now();
    return [
      new Date(now - 9 * 60_000).toISOString(),
      new Date(now - 7 * 60_000).toISOString(),
      new Date(now - 5 * 60_000).toISOString(),
      new Date(now - 3 * 60_000).toISOString(),
      new Date(now - 2 * 60_000).toISOString(),
    ];
  }
});
