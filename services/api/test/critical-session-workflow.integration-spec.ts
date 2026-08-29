import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import {
  buildCompetitionPeriods,
  dateKeyInTimezone,
} from '../src/modules/competitions/competition-calendar';
import { CompetitionLifecycleService } from '../src/modules/competitions/competition-lifecycle.service';
import { AutomaticWeeklyMatchingService } from '../src/modules/competitions/automatic-weekly-matching.service';
import { CompetitionScoringService } from '../src/modules/competitions/competition-scoring.service';
import { CompetitionsService } from '../src/modules/competitions/competitions.service';
import { buildSeedCommitment } from '../src/modules/draws/draw-algorithm';
import { DrawsService } from '../src/modules/draws/draws.service';
import { hashOpaqueValue } from '../src/modules/gyms/gym-scan-policy';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';
import { hashLegalDocumentContent } from '../src/modules/legal/legal-document';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { ResultsService } from '../src/modules/results/results.service';
import { AdminRewardAwardsService } from '../src/modules/rewards/admin-reward-awards.service';
import { AdminRewardsService } from '../src/modules/rewards/admin-rewards.service';
import {
  RewardAwardStatusAction,
  RewardCatalogStatusAction,
  RewardTypeDto,
} from '../src/modules/rewards/dto/reward.dto';
import { RewardCodeCipherService } from '../src/modules/rewards/reward-code-cipher.service';
import { defaultRewardTermsUrl } from '../src/modules/rewards/reward-defaults';
import { RewardsService } from '../src/modules/rewards/rewards.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { SocialService } from '../src/modules/social/social.service';
import { loadPublicStreaks } from '../src/modules/streaks/public-streaks';
import { StreaksService } from '../src/modules/streaks/streaks.service';
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

const contestPinningPrincipal: AuthenticatedPrincipal = {
  email: 'contest-pinning-user@integration.test',
  emailVerified: true,
  firebaseUid: 'contest-pinning-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const concurrentEnrollmentPrincipal: AuthenticatedPrincipal = {
  email: 'concurrent-enrollment-user@integration.test',
  emailVerified: true,
  firebaseUid: 'concurrent-enrollment-user',
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
  monthKey: string;
  regionVerificationId: string;
}

describeWithDatabase('critical session and ledger workflow', () => {
  jest.setTimeout(120_000);

  let adminRewardAwards: AdminRewardAwardsService;
  let adminRewards: AdminRewardsService;
  let competitions: CompetitionsService;
  let database: DatabaseService;
  let draws: DrawsService;
  let enqueueNotification: jest.Mock;
  let lifecycle: CompetitionLifecycleService;
  let migrated: MigratedPostgisTestDatabase;
  let legalDocuments: LegalDocumentsService;
  let operatorUserId: string;
  let profiles: ProfilesService;
  let registrationFixtureSequence = 0;
  let results: ResultsService;
  let rewards: RewardsService;
  let sessions: SessionsService;
  let social: SocialService;
  let streaks: StreaksService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    const config = createTestConfig(migrated.databaseUrl, {
      REWARD_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    });
    database = new DatabaseService(config);
    const idempotency = new IdempotencyService(database);
    const ledger = new LedgerService();
    profiles = new ProfilesService(database);
    results = new ResultsService(database, profiles);
    const rewardCipher = new RewardCodeCipherService(config);
    const adminAuthorization = new AdminAuthorizationService(profiles);
    rewards = new RewardsService(rewardCipher, database, idempotency, profiles);
    adminRewards = new AdminRewardsService(
      adminAuthorization,
      rewardCipher,
      idempotency,
    );
    adminRewardAwards = new AdminRewardAwardsService(
      adminAuthorization,
      idempotency,
    );
    legalDocuments = new LegalDocumentsService(database, idempotency, profiles);
    enqueueNotification = jest.fn();
    const notifications = {
      enqueue: enqueueNotification,
    } as unknown as NotificationsService;
    lifecycle = new CompetitionLifecycleService(database, notifications);
    draws = new DrawsService(
      notifications,
      rewards,
      new CompetitionScoringService(database, ledger),
    );
    competitions = new CompetitionsService(
      database,
      idempotency,
      ledger,
      legalDocuments,
      profiles,
      lifecycle,
      new AutomaticWeeklyMatchingService(),
    );
    social = new SocialService(database, idempotency, profiles);
    sessions = new SessionsService(database, idempotency, ledger, profiles);
    streaks = new StreaksService(database, profiles);
    const operator = await profiles.ensureUser(
      operatorPrincipal,
      database.connection,
    );
    operatorUserId = operator.id;
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', operatorUserId)
      .executeTakeFirstOrThrow();
    await seedAccountLegalDocuments();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('activates a due contest during the member read and queues the entrant without inventing a partner', async () => {
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

    const matches = await migrated.pool.query<{
      status: string;
      user_b_id: string | null;
    }>(
      `SELECT status::text, user_b_id
       FROM competition_matches
       WHERE competition_id = $1`,
      [fixture.competitionId],
    );
    expect(matches.rows).toEqual([{ status: 'searching', user_b_id: null }]);
  });

  it('requires an accepted friend request and explicit Weekly Challenge acceptance', async () => {
    const fixture = await seedRegistrationCompetition();
    const firstUser = await profiles.ensureUser(
      userPrincipal,
      database.connection,
    );
    const secondUser = await profiles.ensureUser(
      pairingPrincipal,
      database.connection,
    );
    await Promise.all([
      profiles.ensureProfile(firstUser.id, database.connection),
      profiles.ensureProfile(secondUser.id, database.connection),
    ]);
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
        method: 'device_location',
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
    const queuedMatches = await database.connection
      .selectFrom('competition_matches')
      .select(['period_index', 'status', 'user_a_id', 'user_b_id'])
      .where('competition_id', '=', fixture.competitionId)
      .orderBy('period_index')
      .execute();
    expect(queuedMatches).toEqual([
      expect.objectContaining({
        status: 'searching',
        user_a_id: firstUser.id,
        user_b_id: null,
      }),
    ]);

    await database.connection
      .insertInto('user_blocks')
      .values({ blocker_user_id: firstUser.id, blocked_user_id: secondUser.id })
      .executeTakeFirstOrThrow();

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
    await database.connection
      .deleteFrom('user_blocks')
      .where('blocker_user_id', '=', firstUser.id)
      .where('blocked_user_id', '=', secondUser.id)
      .executeTakeFirstOrThrow();
    const region = await database.connection
      .selectFrom('competitions as competition')
      .innerJoin(
        'region_policies as policy',
        'policy.id',
        'competition.region_policy_id',
      )
      .select(['policy.code', 'policy.timezone'])
      .where('competition.id', '=', fixture.competitionId)
      .executeTakeFirstOrThrow();
    const now = new Date();
    await database.connection
      .updateTable('competitions')
      .set({
        ends_at: new Date(now.getTime() + 24 * 60 * 60_000),
        registration_closes_at: new Date(now.getTime() - 2_000),
        starts_at: new Date(now.getTime() - 1_000),
        status: 'active',
      })
      .where('id', '=', fixture.competitionId)
      .executeTakeFirstOrThrow();
    const dateKey = dateKeyInTimezone(now, region.timezone);
    const period = buildCompetitionPeriods(fixture.monthKey).find(
      ({ startDateKey, endDateKey }) =>
        dateKey >= startDateKey && dateKey <= endDateKey,
    );
    expect(period).toBeDefined();
    const requestInput = {
      competitionId: fixture.competitionId,
      goal: 3,
      period: period!.index,
      recipientUserId: secondUser.id,
      region: region.code,
    };

    await expect(
      competitions.listEligibleWeeklyChallengePartners(
        userPrincipal,
        fixture.monthKey,
        requestInput,
      ),
    ).resolves.toEqual([]);
    await expect(
      competitions.createWeeklyChallengeRequest(
        userPrincipal,
        fixture.monthKey,
        'weekly-pairing-stranger-request',
        requestInput,
      ),
    ).rejects.toMatchObject({
      response: { code: 'WEEKLY_CHALLENGE_FRIEND_REQUIRED' },
    });
    await expect(
      database.connection
        .insertInto('competition_matches')
        .values({
          competition_id: fixture.competitionId,
          created_at: now,
          outcome: null,
          period_end_date: period!.endDateKey,
          period_index: period!.index,
          period_start_date: period!.startDateKey,
          settled_at: null,
          status: 'matched',
          user_a_id: firstUser.id,
          user_b_id: secondUser.id,
          weekly_challenge_request_id: null,
        })
        .execute(),
    ).rejects.toThrow(/competition_match_participants_one_active_period/i);

    const [userAId, userBId] = [firstUser.id, secondUser.id].sort();
    await database.connection
      .insertInto('friendships')
      .values({ user_a_id: userAId, user_b_id: userBId })
      .executeTakeFirstOrThrow();
    await expect(
      competitions.listEligibleWeeklyChallengePartners(
        userPrincipal,
        fixture.monthKey,
        requestInput,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        goalDays: 3,
        requestStatus: 'available',
        userId: secondUser.id,
      }),
    ]);

    const cancelled = await competitions.createWeeklyChallengeRequest(
      userPrincipal,
      fixture.monthKey,
      'weekly-pairing-cancel-create',
      requestInput,
    );
    const cancellation = await competitions.cancelWeeklyChallengeRequest(
      userPrincipal,
      cancelled.id,
      'weekly-pairing-cancel',
    );
    await expect(
      competitions.cancelWeeklyChallengeRequest(
        userPrincipal,
        cancelled.id,
        'weekly-pairing-cancel',
      ),
    ).resolves.toEqual(cancellation);
    expect(cancellation.status).toBe('cancelled');

    const declined = await competitions.createWeeklyChallengeRequest(
      userPrincipal,
      fixture.monthKey,
      'weekly-pairing-decline-create',
      requestInput,
    );
    await expect(
      competitions.respondToWeeklyChallengeRequest(
        pairingPrincipal,
        declined.id,
        'weekly-pairing-decline',
        'declined',
      ),
    ).resolves.toMatchObject({ status: 'declined' });

    const acceptedRequest = await competitions.createWeeklyChallengeRequest(
      userPrincipal,
      fixture.monthKey,
      'weekly-pairing-accept-create',
      requestInput,
    );
    const acceptanceKeys = [
      'weekly-pairing-accept-a',
      'weekly-pairing-accept-b',
    ];
    const concurrentAccepts = await Promise.allSettled(
      acceptanceKeys.map((idempotencyKey) =>
        competitions.respondToWeeklyChallengeRequest(
          pairingPrincipal,
          acceptedRequest.id,
          idempotencyKey,
          'accepted',
        ),
      ),
    );
    expect(
      concurrentAccepts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      concurrentAccepts.filter(({ status }) => status === 'rejected'),
    ).toHaveLength(1);
    const acceptedIndex = concurrentAccepts.findIndex(
      ({ status }) => status === 'fulfilled',
    );
    const accepted = await competitions.respondToWeeklyChallengeRequest(
      pairingPrincipal,
      acceptedRequest.id,
      acceptanceKeys[acceptedIndex],
      'accepted',
    );
    expect(accepted).toMatchObject({ status: 'accepted' });

    const pairedMatches = await database.connection
      .selectFrom('competition_matches')
      .select([
        'period_index',
        'status',
        'user_a_id',
        'user_b_id',
        'weekly_challenge_request_id',
      ])
      .where('competition_id', '=', fixture.competitionId)
      .where('status', '!=', 'cancelled')
      .execute();
    expect(pairedMatches).toEqual([
      {
        period_index: period!.index,
        status: 'matched',
        user_a_id: userAId,
        user_b_id: userBId,
        weekly_challenge_request_id: acceptedRequest.id,
      },
    ]);
    await expect(
      database.connection
        .insertInto('competition_matches')
        .values({
          competition_id: fixture.competitionId,
          created_at: now,
          outcome: null,
          period_end_date: period!.endDateKey,
          period_index: period!.index,
          period_start_date: period!.startDateKey,
          settled_at: null,
          status: 'searching',
          user_a_id: secondUser.id,
          user_b_id: null,
          weekly_challenge_request_id: null,
        })
        .execute(),
    ).rejects.toThrow(/competition_match_participants_one_active_period/i);

    const directMatches = await competitions.getMatches(
      pairingPrincipal,
      fixture.monthKey,
      3,
      region.code,
      fixture.competitionId,
    );
    expect(directMatches).toHaveLength(4);
    expect(directMatches[period!.index - 1]).toMatchObject({
      availability: 'matched',
      opponentAlias: expect.any(String),
      scoringStatus: 'projected',
    });
    expect(Object.keys(directMatches[period!.index - 1]).sort()).toEqual([
      'availability',
      'entries',
      'multiplier',
      'opponentAlias',
      'opponentBestStreak',
      'opponentCurrentStreak',
      'opponentMonthlyVerifiedDays',
      'opponentStreaks',
      'opponentVerifiedCount',
      'periodIndex',
      'region',
      'scoringStatus',
    ]);
    await expect(
      competitions.createWeeklyChallengeRequest(
        userPrincipal,
        fixture.monthKey,
        'weekly-pairing-second-assignment',
        requestInput,
      ),
    ).rejects.toMatchObject({
      response: { code: 'WEEKLY_CHALLENGE_ALREADY_ASSIGNED' },
    });

    await expect(
      social.removeFriend(
        userPrincipal,
        'weekly-pairing-remove-friend',
        secondUser.id,
      ),
    ).resolves.toMatchObject({ action: 'removed', userId: secondUser.id });
    const closedDirectState = await database.connection
      .selectFrom('competition_matches as match')
      .innerJoin(
        'weekly_challenge_requests as request',
        'request.id',
        'match.weekly_challenge_request_id',
      )
      .select([
        'match.status as match_status',
        'request.cancellation_reason',
        'request.status as request_status',
      ])
      .where('match.competition_id', '=', fixture.competitionId)
      .where('match.period_index', '=', period!.index)
      .executeTakeFirstOrThrow();
    expect(closedDirectState).toEqual({
      cancellation_reason: 'friendship_removed',
      match_status: 'cancelled',
      request_status: 'cancelled',
    });
    const soloAfterRemoval = await competitions.getMatches(
      userPrincipal,
      fixture.monthKey,
      3,
      region.code,
      fixture.competitionId,
    );
    expect(soloAfterRemoval[period!.index - 1]).toMatchObject({
      availability: 'solo',
      opponentAlias: null,
      scoringStatus: 'projected',
    });
    await database.connection
      .insertInto('friendships')
      .values({ user_a_id: userAId, user_b_id: userBId })
      .executeTakeFirstOrThrow();
    const pendingBeforeBlock = await database.connection
      .insertInto('weekly_challenge_requests')
      .values({
        accepted_at: null,
        cancellation_reason: null,
        competition_id: fixture.competitionId,
        created_at: new Date(),
        goal_days: 3,
        period_index: period!.index,
        recipient_user_id: secondUser.id,
        requester_user_id: firstUser.id,
        status: 'pending',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await social.blockMember(
      userPrincipal,
      'weekly-pairing-block-friend',
      secondUser.id,
    );
    const blockedRequest = await database.connection
      .selectFrom('weekly_challenge_requests')
      .select(['cancellation_reason', 'status'])
      .where('id', '=', pendingBeforeBlock.id)
      .executeTakeFirstOrThrow();
    expect(blockedRequest).toEqual({
      cancellation_reason: 'member_blocked',
      status: 'cancelled',
    });
    await expect(
      competitions.listEligibleWeeklyChallengePartners(
        userPrincipal,
        fixture.monthKey,
        requestInput,
      ),
    ).resolves.toEqual([]);
  });

  it('serializes concurrent poster enrollments onto one immutable gym selection', async () => {
    const fixture = await seedRegistrationCompetition(
      concurrentEnrollmentPrincipal,
    );
    const request = {
      ageEligibilityAttested: true as const,
      goalDays: 3,
      gymPresence: fixture.gymPresence,
      legalReceiptBundleId: fixture.legalReceiptBundleId,
      regionVerificationId: fixture.regionVerificationId,
      rulesAccepted: true as const,
    };
    const [first, second] = await Promise.all([
      competitions.enroll(
        concurrentEnrollmentPrincipal,
        fixture.competitionId,
        'concurrent-gym-enrollment-a',
        request,
      ),
      competitions.enroll(
        concurrentEnrollmentPrincipal,
        fixture.competitionId,
        'concurrent-gym-enrollment-b',
        request,
      ),
    ]);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      gymCredentialVersion: expect.any(Number),
      gymLocationId: expect.any(String),
      gymName: 'Critical Session Gym',
    });
    const member = await profiles.ensureUser(
      concurrentEnrollmentPrincipal,
      database.connection,
    );
    const persisted = await database.connection
      .selectFrom('competition_enrollments')
      .select(['gym_credential_version', 'gym_location_id'])
      .where('competition_id', '=', fixture.competitionId)
      .where('user_id', '=', member.id)
      .execute();
    expect(persisted).toEqual([
      {
        gym_credential_version: first.gymCredentialVersion,
        gym_location_id: first.gymLocationId,
      },
    ]);
  });

  it('pins enrollment to the scanned contest when a later contest shares one gym', async () => {
    const fixture = await seedRegistrationCompetition(contestPinningPrincipal);
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
        expires_at: laterContestEndsAt,
        gym_location_id: source.gym_location_id,
        issued_by_user_id: operatorUserId,
        qr_payload: `https://app.gogymgo.com/scan?credential=${otherCredential}`,
        status: 'active',
        token_hash: hashOpaqueValue(otherCredential),
      })
      .execute();

    await expect(
      competitions.resolveGymQrCompetition(
        contestPinningPrincipal,
        otherCredential,
      ),
    ).resolves.toMatchObject({
      id: otherCompetition.id,
      name: 'Later Contest At Same Gym',
    });
    await expect(
      competitions.resolveGymQrCompetition(
        contestPinningPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toMatchObject({ id: fixture.competitionId });
    await expect(
      competitions.enroll(
        contestPinningPrincipal,
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
      contestPinningPrincipal,
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
    await expect(
      competitions.getCurrent(contestPinningPrincipal),
    ).resolves.toMatchObject({
      id: otherCompetition.id,
    });
    await expect(
      competitions.resolveGymQrCompetition(
        contestPinningPrincipal,
        fixture.gymPresence.credential,
      ),
    ).resolves.toMatchObject({ id: fixture.competitionId });

    await competitions.enroll(
      contestPinningPrincipal,
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
      competitions.getCurrentEnrollment(
        contestPinningPrincipal,
        fixture.competitionId,
      ),
    ).resolves.toMatchObject({
      competitionId: fixture.competitionId,
      gymCredentialVersion: expect.any(Number),
      gymLocationId: source.gym_location_id,
      gymName: 'Critical Session Gym',
    });

    const challengeRecipient = await profiles.ensureUser(
      userPrincipal,
      database.connection,
    );
    const recipientLegalReceiptBundleId = await acceptCurrentLegalBundle(
      userPrincipal,
      'withdrawal-direct-challenge-recipient-legal',
    );
    const recipientVerification = await database.connection
      .insertInto('region_verifications')
      .values({
        evidence_metadata: {},
        expires_at: new Date(Date.now() + 24 * 60 * 60_000),
        method: 'device_location',
        policy_version: 'policy-v1',
        region_policy_id: source.region_policy_id,
        status: 'approved',
        user_id: challengeRecipient.id,
        verified_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'withdrawal-direct-challenge-recipient-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: recipientLegalReceiptBundleId,
        regionVerificationId: recipientVerification.id,
        rulesAccepted: true,
      },
    );

    const activeEnrollment = await migrated.pool.query<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id
       FROM competition_enrollments
       WHERE competition_id = $1 AND user_id = $2 AND status = 'active'`,
      [
        fixture.competitionId,
        (
          await profiles.ensureUser(
            contestPinningPrincipal,
            database.connection,
          )
        ).id,
      ],
    );
    const activeSession = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, gym_location_id, gym_credential_version)
       SELECT $1, $2, $3,
              (competition.starts_at AT TIME ZONE region.timezone)::date,
              'active', 'rules-v1', competition.starts_at,
              enrollment.gym_location_id, enrollment.gym_credential_version
       FROM competition_enrollments AS enrollment
       INNER JOIN competitions AS competition ON competition.id = $1
       INNER JOIN region_policies AS region
         ON region.id = competition.region_policy_id
       WHERE enrollment.id = $2
       RETURNING id`,
      [
        fixture.competitionId,
        activeEnrollment.rows[0].id,
        activeEnrollment.rows[0].user_id,
      ],
    );
    const [challengeUserAId, challengeUserBId] = [
      activeEnrollment.rows[0].user_id,
      challengeRecipient.id,
    ].sort();
    await database.connection
      .insertInto('friendships')
      .values({ user_a_id: challengeUserAId, user_b_id: challengeUserBId })
      .executeTakeFirstOrThrow();
    const challengeRequest = await migrated.pool.query<{ id: string }>(
      `INSERT INTO weekly_challenge_requests
         (competition_id, period_index, requester_user_id, recipient_user_id,
          goal_days, status, responded_at, accepted_at)
       VALUES ($1, 1, $2, $3, 3, 'accepted', current_timestamp,
               current_timestamp)
       RETURNING id`,
      [
        fixture.competitionId,
        activeEnrollment.rows[0].user_id,
        challengeRecipient.id,
      ],
    );
    await migrated.pool.query(
      `INSERT INTO competition_matches
         (competition_id, period_index, period_start_date, period_end_date,
          user_a_id, user_b_id, status, weekly_challenge_request_id)
       VALUES ($1, 1, ($2 || '-01')::date, ($2 || '-07')::date,
               $3, $4, 'matched', $5)`,
      [
        fixture.competitionId,
        fixture.monthKey,
        challengeUserAId,
        challengeUserBId,
        challengeRequest.rows[0].id,
      ],
    );
    await expect(
      competitions.withdrawEnrollment(
        contestPinningPrincipal,
        fixture.competitionId,
        'withdraw-scanned-earlier-contest',
      ),
    ).resolves.toMatchObject({
      competitionId: fixture.competitionId,
      status: 'withdrawn',
    });
    await expect(
      competitions.getCurrentEnrollment(
        contestPinningPrincipal,
        fixture.competitionId,
      ),
    ).resolves.toBeNull();
    const cancelledSession = await migrated.pool.query<{ status: string }>(
      `SELECT status FROM workout_sessions WHERE id = $1`,
      [activeSession.rows[0].id],
    );
    expect(cancelledSession.rows[0].status).toBe('cancelled');
    const closedParticipation = await migrated.pool.query<{
      audit_count: number;
      cancellation_reason: string;
      challenge_status: string;
      match_count: number;
    }>(
      `SELECT
         (SELECT count(*)::integer
          FROM operator_audit_events
          WHERE action = 'competition.enrollment_withdrawn'
            AND entity_id = $1) AS audit_count,
         (SELECT status::text
          FROM weekly_challenge_requests
          WHERE id = $2) AS challenge_status,
         (SELECT cancellation_reason
          FROM weekly_challenge_requests
          WHERE id = $2) AS cancellation_reason,
         (SELECT count(*)::integer
          FROM competition_matches
          WHERE competition_id = $3
            AND (user_a_id = $4 OR user_b_id = $4)
            AND status = 'cancelled') AS match_count`,
      [
        activeEnrollment.rows[0].id,
        challengeRequest.rows[0].id,
        fixture.competitionId,
        activeEnrollment.rows[0].user_id,
      ],
    );
    expect(closedParticipation.rows[0]).toEqual({
      audit_count: 1,
      cancellation_reason: 'enrollment_withdrawn',
      challenge_status: 'cancelled',
      match_count: 2,
    });
    await expect(
      competitions.withdrawEnrollment(
        contestPinningPrincipal,
        fixture.competitionId,
        'withdraw-scanned-earlier-contest-retry',
      ),
    ).resolves.toMatchObject({ status: 'withdrawn' });
    const auditRetry = await migrated.pool.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM operator_audit_events
       WHERE action = 'competition.enrollment_withdrawn'
         AND entity_id = $1`,
      [activeEnrollment.rows[0].id],
    );
    expect(auditRetry.rows[0].count).toBe(1);
    await expect(
      migrated.pool.query(
        `UPDATE competition_enrollments SET goal_days = 4 WHERE id = $1`,
        [activeEnrollment.rows[0].id],
      ),
    ).rejects.toThrow('Weekly Goal are immutable');
    await expect(
      migrated.pool.query(
        `UPDATE competition_enrollments
         SET gym_credential_version = gym_credential_version + 1
         WHERE id = $1`,
        [activeEnrollment.rows[0].id],
      ),
    ).rejects.toThrow('evidence, and Weekly Goal are immutable');
    await expect(
      migrated.pool.query(
        `UPDATE competition_enrollments SET status = 'active' WHERE id = $1`,
        [activeEnrollment.rows[0].id],
      ),
    ).rejects.toThrow('status is terminal');
  });

  it('rolls back and safely retries an under-minimum lifecycle cancellation', async () => {
    const fixture = await seedRegistrationCompetition();
    const enrollment = await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'under-minimum-lifecycle-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    expect(enrollment).toMatchObject({
      gymCredentialVersion: expect.any(Number),
      gymLocationId: expect.any(String),
      gymName: 'Critical Session Gym',
    });
    const member = await profiles.ensureUser(
      userPrincipal,
      database.connection,
    );
    const session = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, gym_location_id, gym_credential_version)
       SELECT $1, $2, $3,
              (competition.starts_at AT TIME ZONE region.timezone)::date,
              'active', 'rules-v1', competition.starts_at,
              enrollment.gym_location_id, enrollment.gym_credential_version
       FROM competition_enrollments AS enrollment
       INNER JOIN competitions AS competition ON competition.id = $1
       INNER JOIN region_policies AS region
         ON region.id = competition.region_policy_id
       WHERE enrollment.id = $2
       RETURNING id`,
      [fixture.competitionId, enrollment.id, member.id],
    );
    const pendingChallenge = await database.connection
      .insertInto('weekly_challenge_requests')
      .values({
        accepted_at: null,
        cancellation_reason: null,
        competition_id: fixture.competitionId,
        created_at: new Date(),
        goal_days: 3,
        period_index: 1,
        recipient_user_id: operatorUserId,
        requester_user_id: member.id,
        status: 'pending',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const dueAt = new Date(Date.now() - 1_000);
    await migrated.pool.query(
      `UPDATE competitions
       SET minimum_entrants = 2,
           registration_closes_at = $1,
           starts_at = $1
       WHERE id = $2`,
      [dueAt, fixture.competitionId],
    );

    enqueueNotification.mockRejectedValueOnce(
      new Error('simulated notification enqueue failure'),
    );
    await expect(
      lifecycle.processDueStart(fixture.competitionId, new Date()),
    ).rejects.toThrow('simulated notification enqueue failure');
    const rolledBack = await migrated.pool.query<{
      audit_count: number;
      competition_status: string;
      enrollment_status: string;
      request_status: string;
      session_status: string;
    }>(
      `SELECT
         (SELECT status::text FROM competitions WHERE id = $1) AS competition_status,
         (SELECT status::text FROM competition_enrollments WHERE id = $2) AS enrollment_status,
         (SELECT status::text FROM workout_sessions WHERE id = $3) AS session_status,
         (SELECT status::text FROM weekly_challenge_requests WHERE id = $4) AS request_status,
         (SELECT count(*)::integer FROM operator_audit_events
          WHERE action = 'competition.cancelled_under_minimum'
            AND entity_id = $1) AS audit_count`,
      [
        fixture.competitionId,
        enrollment.id,
        session.rows[0].id,
        pendingChallenge.id,
      ],
    );
    expect(rolledBack.rows[0]).toEqual({
      audit_count: 0,
      competition_status: 'registration',
      enrollment_status: 'active',
      request_status: 'pending',
      session_status: 'active',
    });

    enqueueNotification.mockResolvedValue(undefined);
    await expect(
      lifecycle.processDueStart(fixture.competitionId, new Date()),
    ).resolves.toBe('cancelled');
    await expect(
      lifecycle.processDueStart(fixture.competitionId, new Date()),
    ).resolves.toBeNull();
    const closed = await migrated.pool.query<{
      audit_count: number;
      competition_status: string;
      enrollment_status: string;
      match_count: number;
      request_reason: string;
      request_status: string;
      session_status: string;
    }>(
      `SELECT
         (SELECT status::text FROM competitions WHERE id = $1) AS competition_status,
         (SELECT status::text FROM competition_enrollments WHERE id = $2) AS enrollment_status,
         (SELECT status::text FROM workout_sessions WHERE id = $3) AS session_status,
         (SELECT count(*)::integer FROM competition_matches
          WHERE competition_id = $1 AND status = 'cancelled') AS match_count,
         (SELECT cancellation_reason FROM weekly_challenge_requests
          WHERE id = $4) AS request_reason,
         (SELECT status::text FROM weekly_challenge_requests
          WHERE id = $4) AS request_status,
         (SELECT count(*)::integer FROM operator_audit_events
          WHERE action = 'competition.cancelled_under_minimum'
            AND entity_id = $1) AS audit_count`,
      [
        fixture.competitionId,
        enrollment.id,
        session.rows[0].id,
        pendingChallenge.id,
      ],
    );
    expect(closed.rows[0]).toEqual({
      audit_count: 1,
      competition_status: 'cancelled',
      enrollment_status: 'withdrawn',
      match_count: 1,
      request_reason: 'competition_cancelled',
      request_status: 'cancelled',
      session_status: 'cancelled',
    });
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
    const reward = await migrated.pool.query<{ id: string }>(
      `INSERT INTO reward_catalog_items
         (competition_id, sponsor_name, title, description, reward_type,
          status, inventory_total, display_order, version, image_url,
          terms_url, fulfillment_instructions)
       VALUES ($1, 'GoGymGo', 'Recovery Kit', 'Participant result test reward',
               'physical', 'draft', 1, 1, 1,
               'https://cdn.example.com/recovery-kit.jpg',
               'https://example.com/recovery-kit-terms',
               'Collect at the partner gym.')
       RETURNING id`,
      [fixture.competitionId],
    );
    await migrated.pool.query(
      `UPDATE reward_catalog_items
       SET status = 'published', version = version + 1
       WHERE id = $1`,
      [reward.rows[0].id],
    );
    await migrated.pool.query(
      `UPDATE competitions
       SET status = 'active', minimum_entrants = 1,
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
    const originalProfile = await profiles.getMe(userPrincipal);
    const originalAlias =
      originalProfile.publicIdentityMode === 'private'
        ? originalProfile.callsign
        : (originalProfile.publicName ?? originalProfile.callsign);
    await migrated.pool.query(
      `UPDATE competition_progress
       SET category_score = 7, verified_days = 1
       WHERE competition_id = $1 AND user_id = $2`,
      [fixture.competitionId, user.id],
    );
    const seedReveal = 'b'.repeat(64);
    const locked = await database.connection
      .transaction()
      .execute((transaction) =>
        draws.lock(transaction, {
          competitionId: fixture.competitionId,
          operatorUserId,
          reason: 'Lock the participant results integration snapshot.',
          requestId: 'participant-results-draw-lock',
          seedCommitment: buildSeedCommitment(seedReveal),
        }),
      );
    await database.connection.transaction().execute((transaction) =>
      draws.settle(transaction, {
        drawId: locked.drawId,
        operatorUserId,
        reason: 'Settle the participant results integration snapshot.',
        requestId: 'participant-results-draw-settle',
        seedReveal,
      }),
    );
    await migrated.pool.query(
      `UPDATE profiles
       SET callsign = 'MUTATED_ALIAS', public_name = 'Mutated public name'
       WHERE user_id = $1`,
      [user.id],
    );
    await expect(
      migrated.pool.query(
        `UPDATE reward_catalog_items
       SET title = 'Mutated reward title'
       WHERE id = $1`,
        [reward.rows[0].id],
      ),
    ).rejects.toThrow(/published reward configuration is immutable/i);
    await migrated.pool.query(
      `UPDATE reward_catalog_items
       SET status = 'archived', version = version + 1
       WHERE id = $1`,
      [reward.rows[0].id],
    );
    const award = await migrated.pool.query<{ id: string }>(
      `SELECT id
       FROM reward_awards
       WHERE draw_id = $1 AND user_id = $2`,
      [locked.drawId, user.id],
    );

    await expect(
      results.getLatestParticipantResults(userPrincipal),
    ).resolves.toMatchObject({
      categoryLeaderboards: [
        {
          goal: 3,
          rows: [
            {
              alias: originalAlias,
              categoryEntries: 0,
              rank: 1,
              verifiedDays: 0,
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
          alias: originalAlias,
          awardRank: 1,
          prizeDrawEntries: 1,
          rewardTitle: 'Recovery Kit',
          rewardType: 'physical',
          sponsorName: 'GoGymGo',
        },
      ],
      settledAt: expect.any(String),
    });

    await migrated.pool.query(
      `UPDATE profiles
       SET callsign = $1, public_name = $2
       WHERE user_id = $3`,
      [originalProfile.callsign, originalProfile.publicName, user.id],
    );
    await expect(rewards.getMyAwards(userPrincipal)).resolves.toMatchObject([
      {
        id: award.rows[0].id,
        rewardType: 'physical',
        status: 'awarded',
        title: 'Recovery Kit',
      },
    ]);
    const claim = await rewards.claim(
      userPrincipal,
      award.rows[0].id,
      'participant-results-reward-claim',
    );
    await expect(
      rewards.claim(
        userPrincipal,
        award.rows[0].id,
        'participant-results-reward-claim',
      ),
    ).resolves.toEqual(claim);
    expect(claim).toMatchObject({
      fulfillmentInstructions: 'Collect at the partner gym.',
      id: award.rows[0].id,
      status: 'claimed',
    });
  });

  it('keeps coupon inventory confidential while allocating and claiming exactly once', async () => {
    const fixture = await seedRegistrationCompetition();
    const canonicalCouponCode = 'WIN-ABC-001';
    const created = await adminRewards.create(
      operatorPrincipal,
      'coupon-reward-create',
      {
        competitionId: fixture.competitionId,
        description: 'Single-use recovery sponsor coupon.',
        inventoryTotal: 1,
        reason: 'Configure the tested sponsor coupon inventory.',
        rewardType: RewardTypeDto.COUPON,
        sponsorName: 'Recovery Sponsor',
        title: 'Recovery coupon',
      },
    );
    const uploaded = await adminRewards.addCouponCodes(
      operatorPrincipal,
      created.id,
      'coupon-reward-upload',
      {
        codes: ['  WIN-ＡＢＣ-001  '],
        expectedVersion: created.version,
        reason: 'Upload the approved single-use sponsor coupon.',
      },
    );
    expect(uploaded).toEqual({
      added: 1,
      rewardId: created.id,
      version: 2,
    });
    await expect(
      adminRewards.addCouponCodes(
        operatorPrincipal,
        created.id,
        'coupon-reward-duplicate-upload',
        {
          codes: [canonicalCouponCode],
          expectedVersion: uploaded.version,
          reason: 'Reject a duplicate sponsor coupon upload.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'REWARD_COUPON_CODE_DUPLICATE' },
    });
    const published = await adminRewards.changeStatus(
      operatorPrincipal,
      created.id,
      'coupon-reward-publish',
      {
        action: RewardCatalogStatusAction.PUBLISH,
        expectedVersion: uploaded.version,
        reason: 'Publish the complete approved sponsor coupon.',
      },
    );
    expect(published).toMatchObject({ status: 'published', version: 3 });

    const catalogRegion = await migrated.pool.query<{ code: string }>(
      `SELECT region.code
       FROM competitions AS competition
       JOIN region_policies AS region ON region.id = competition.region_policy_id
       WHERE competition.id = $1`,
      [fixture.competitionId],
    );
    await expect(
      rewards.getCatalog(catalogRegion.rows[0].code, fixture.monthKey),
    ).resolves.toEqual([
      expect.objectContaining({
        id: created.id,
        imageUrl: null,
        inventoryRemaining: 1,
        inventoryTotal: 1,
        regionTimezone: 'America/Vancouver',
        rewardType: 'coupon',
        termsUrl: defaultRewardTermsUrl,
      }),
    ]);

    await competitions.enroll(
      userPrincipal,
      fixture.competitionId,
      'coupon-reward-draw-enrollment',
      {
        ageEligibilityAttested: true,
        goalDays: 3,
        gymPresence: fixture.gymPresence,
        legalReceiptBundleId: fixture.legalReceiptBundleId,
        regionVerificationId: fixture.regionVerificationId,
        rulesAccepted: true,
      },
    );
    const drawReference = new Date();
    await migrated.pool.query(
      `UPDATE competitions
       SET status = 'active', minimum_entrants = 1,
           registration_opens_at = $1, registration_closes_at = $2,
           starts_at = $3, ends_at = $4
       WHERE id = $5`,
      [
        new Date(drawReference.getTime() - 90 * 60_000),
        new Date(drawReference.getTime() - 70 * 60_000),
        new Date(drawReference.getTime() - 60 * 60_000),
        new Date(drawReference.getTime() - 16 * 60_000),
        fixture.competitionId,
      ],
    );
    const winner = await profiles.ensureUser(
      userPrincipal,
      database.connection,
    );
    const otherUser = await profiles.ensureUser(
      pairingPrincipal,
      database.connection,
    );
    const seedReveal = '2'.repeat(64);
    const locked = await database.connection
      .transaction()
      .execute((transaction) =>
        draws.lock(transaction, {
          competitionId: fixture.competitionId,
          operatorUserId,
          reason: 'Lock the coupon inventory integration snapshot.',
          requestId: 'coupon-reward-draw-lock',
          seedCommitment: buildSeedCommitment(seedReveal),
        }),
      );
    await database.connection.transaction().execute((transaction) =>
      draws.settle(transaction, {
        drawId: locked.drawId,
        operatorUserId,
        reason: 'Settle the coupon inventory integration snapshot.',
        requestId: 'coupon-reward-draw-settle',
        seedReveal,
      }),
    );
    const award = await migrated.pool.query<{ id: string }>(
      `SELECT id
       FROM reward_awards
       WHERE draw_id = $1 AND user_id = $2`,
      [locked.drawId, winner.id],
    );

    await expect(
      migrated.pool.query(
        `INSERT INTO reward_awards
           (draw_id, reward_catalog_item_id, user_id, award_rank, status,
            awarded_at, updated_at)
         VALUES ($1, $2, $3, 2, 'awarded', $4, $4)`,
        [locked.drawId, created.id, otherUser.id, new Date()],
      ),
    ).rejects.toThrow(/exact locked reward slot/i);
    await expect(
      rewards.claim(
        pairingPrincipal,
        award.rows[0].id,
        'coupon-reward-wrong-owner-claim',
      ),
    ).rejects.toMatchObject({
      response: { code: 'REWARD_AWARD_NOT_FOUND' },
    });

    const claims = await Promise.all([
      rewards.claim(
        userPrincipal,
        award.rows[0].id,
        'coupon-reward-owner-claim-a',
      ),
      rewards.claim(
        userPrincipal,
        award.rows[0].id,
        'coupon-reward-owner-claim-b',
      ),
    ]);
    expect(claims[0]).toMatchObject({
      claimUrl: null,
      couponCode: canonicalCouponCode,
      fulfillmentInstructions: null,
      id: award.rows[0].id,
      status: 'claimed',
    });
    expect(claims[1]).toEqual(claims[0]);
    await expect(rewards.getMyAwards(userPrincipal)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: award.rows[0].id,
          status: 'claimed',
        }),
      ]),
    );
    await expect(
      rewards.getCatalog(catalogRegion.rows[0].code, fixture.monthKey),
    ).resolves.toEqual([]);
    const allocatedInventory = await migrated.pool.query<{
      awarded_count: number;
      inventory_total: number;
    }>(
      `SELECT item.inventory_total,
              count(award.id)::integer AS awarded_count
       FROM reward_catalog_items AS item
       LEFT JOIN reward_awards AS award
         ON award.reward_catalog_item_id = item.id
        AND award.status <> 'cancelled'
       WHERE item.id = $1
       GROUP BY item.id`,
      [created.id],
    );
    expect(allocatedInventory.rows[0]).toEqual({
      awarded_count: 1,
      inventory_total: 1,
    });

    const redeemed = await adminRewardAwards.changeStatus(
      operatorPrincipal,
      award.rows[0].id,
      'coupon-reward-redeem',
      {
        action: RewardAwardStatusAction.REDEEM,
        expectedVersion: 2,
        reason: 'Record the sponsor-confirmed coupon redemption.',
      },
    );
    expect(redeemed).toEqual({
      id: award.rows[0].id,
      status: 'redeemed',
      version: 3,
    });
    await expect(
      adminRewardAwards.changeStatus(
        operatorPrincipal,
        award.rows[0].id,
        'coupon-reward-redeem',
        {
          action: RewardAwardStatusAction.REDEEM,
          expectedVersion: 2,
          reason: 'Record the sponsor-confirmed coupon redemption.',
        },
      ),
    ).resolves.toEqual(redeemed);
    await expect(
      adminRewardAwards.changeStatus(
        operatorPrincipal,
        award.rows[0].id,
        'coupon-reward-stale-redeem',
        {
          action: RewardAwardStatusAction.REDEEM,
          expectedVersion: 2,
          reason: 'Reject a stale duplicate redemption attempt.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'REWARD_AWARD_VERSION_CONFLICT' },
    });

    const persisted = await migrated.pool.query<{
      award_status: string;
      award_version: number;
      code_fingerprint: string;
      encrypted_code: string;
      redeemed_at: Date | null;
    }>(
      `SELECT award.status::text AS award_status,
              award.version AS award_version,
              code.code_fingerprint,
              code.encrypted_code,
              code.redeemed_at
       FROM reward_awards AS award
       JOIN reward_coupon_codes AS code
         ON code.assigned_award_id = award.id
       WHERE award.id = $1`,
      [award.rows[0].id],
    );
    expect(persisted.rows[0]).toMatchObject({
      award_status: 'redeemed',
      award_version: 3,
      code_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      redeemed_at: expect.any(Date),
    });
    expect(persisted.rows[0].encrypted_code).not.toContain(canonicalCouponCode);

    const claimKeys = await migrated.pool.query<{ response_body: unknown }>(
      `SELECT response_body
       FROM idempotency_keys
       WHERE scope = $1
       ORDER BY idempotency_key`,
      [`reward-awards:${award.rows[0].id}:claim`],
    );
    expect(claimKeys.rows).toEqual([
      { response_body: { redacted: true } },
      { response_body: { redacted: true } },
    ]);
    const audit = await migrated.pool.query<{ event: string }>(
      `SELECT jsonb_build_object(
                'action', action,
                'next', next_state,
                'previous', previous_state,
                'reason', reason
              )::text AS event
       FROM operator_audit_events
       WHERE entity_id IN ($1, $2)`,
      [created.id, award.rows[0].id],
    );
    expect(JSON.stringify(audit.rows)).not.toContain(canonicalCouponCode);
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
        expectedVersion: 1,
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
        'verify-session',
        evidenceReview.evidenceSnapshotSha256,
      ),
    ).resolves.toBe(true);

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
          policy_version, started_at, completed_at, gym_location_id,
          gym_credential_version)
       SELECT competition_id, enrollment_id, user_id, eligible_date,
              'pending_review', policy_version, started_at, completed_at,
              gym_location_id, gym_credential_version
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
        expectedVersion: 1,
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
        'reject-duplicate-day',
      ),
    ).resolves.toBe(true);
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

    const streakIndex = await migrated.pool.query<{ indexdef: string }>(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname = 'workout_sessions_user_verified_eligible_date_idx'`,
    );
    expect(streakIndex.rows).toHaveLength(1);
    expect(streakIndex.rows[0].indexdef).toContain(
      '(user_id, eligible_date DESC)',
    );
    expect(streakIndex.rows[0].indexdef).toContain('WHERE');
    expect(streakIndex.rows[0].indexdef).toContain('verified');

    const ownStreaks = await streaks.getMyStreaks(userPrincipal);
    expect(ownStreaks).toMatchObject({
      streaks: {
        daily: 1,
        projectionVersion: 'streaks-v1',
      },
      timezone: 'America/Vancouver',
    });
    const member = await profiles.ensureUser(
      userPrincipal,
      database.connection,
    );
    await migrated.pool.query(
      `UPDATE region_verifications
       SET status = 'expired',
           expires_at = (
             SELECT enrollment.enrolled_at + interval '1 second'
             FROM competition_enrollments AS enrollment
             WHERE enrollment.region_verification_id = region_verifications.id
             LIMIT 1
           )
       WHERE id = $1`,
      [fixture.regionVerificationId],
    );
    await expect(streaks.getMyStreaks(userPrincipal)).resolves.toMatchObject({
      streaks: { daily: 1 },
      timezone: 'America/Vancouver',
    });
    await migrated.pool.query(
      `UPDATE profiles
       SET privacy_settings = jsonb_set(privacy_settings, '{showStats}', 'false')
       WHERE user_id = $1`,
      [member.id],
    );
    await expect(
      loadPublicStreaks(database.connection, [member.id]),
    ).resolves.toEqual(new Map());
    await expect(streaks.getMyStreaks(userPrincipal)).resolves.toMatchObject({
      streaks: { daily: 1 },
    });
    await migrated.pool.query(
      `UPDATE profiles
       SET privacy_settings = jsonb_set(privacy_settings, '{showStats}', 'true')
       WHERE user_id = $1`,
      [member.id],
    );

    const disqualifiedReview = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, completed_at, gym_location_id,
          gym_credential_version)
       SELECT competition_id, enrollment_id, user_id, eligible_date,
              'pending_review', policy_version, started_at, completed_at,
              gym_location_id, gym_credential_version
       FROM workout_sessions
       WHERE id = $1
       RETURNING id`,
      [created.id],
    );
    await migrated.pool.query(
      `UPDATE competition_enrollments
       SET status = 'disqualified'
       WHERE id = $1`,
      [enrollment.id],
    );
    await expect(
      verifySession(
        disqualifiedReview.rows[0].id,
        'verify-disqualified-session',
      ),
    ).rejects.toMatchObject({
      response: { code: 'ACTIVE_ENROLLMENT_REQUIRED' },
    });
    await expect(
      verifiedLedgerCount(disqualifiedReview.rows[0].id),
    ).resolves.toBe(0);
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

    const losingIndex = winnerIndex === 0 ? 1 : 0;
    const losingUser = fixture.users[losingIndex];
    const losingAccount = await profiles.ensureUser(
      losingUser.principal,
      database.connection,
    );
    const otherCompetition = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, status, rules_version, rules,
          minimum_entrants, entrant_cap, registration_opens_at,
          registration_closes_at, starts_at, ends_at)
       SELECT region_policy_id, month_key, 'Other same-month Contest', status,
              rules_version, rules, minimum_entrants, entrant_cap,
              registration_opens_at, registration_closes_at, starts_at, ends_at
       FROM competitions
       WHERE id = $1
       RETURNING id`,
      [fixture.competitionId],
    );
    const acceptance = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competition_rule_acceptances
         (competition_id, user_id, rules_version, age_eligibility_attested)
       VALUES ($1, $2, 'rules-v1', TRUE)
       RETURNING id`,
      [otherCompetition.rows[0].id, losingAccount.id],
    );
    await migrated.pool.query(
      `INSERT INTO competition_goal_brackets (competition_id, goal_days, label)
       VALUES ($1, 3, 'Three days')`,
      [otherCompetition.rows[0].id],
    );
    await migrated.pool.query(
      `INSERT INTO competition_enrollments
         (competition_id, user_id, goal_days, region_verification_id,
          rules_acceptance_id, status)
       VALUES ($1, $2, 3, $3, $4, 'active')`,
      [
        otherCompetition.rows[0].id,
        losingAccount.id,
        losingUser.regionVerificationId,
        acceptance.rows[0].id,
      ],
    );
    await expect(
      competitions.getEnrollmentCount(
        fixture.competitionId,
        '2030-02',
        'critical-capped-enrollment-region',
      ),
    ).resolves.toBe(0);
    await expect(
      competitions.getEnrollmentCount(
        otherCompetition.rows[0].id,
        '2030-02',
        'critical-capped-enrollment-region',
      ),
    ).resolves.toBe(1);

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
      expectedVersion: 1,
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
      expectedVersion: 1,
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

  async function seedRegistrationCompetition(
    principal: AuthenticatedPrincipal = userPrincipal,
  ): Promise<CompetitionFixture> {
    const now = Date.now();
    const monthKeyFormatter = new Intl.DateTimeFormat('en-CA', {
      month: '2-digit',
      timeZone: 'America/Vancouver',
      year: 'numeric',
    });
    const currentMonthKey = monthKeyFormatter.format(new Date(now));
    const regionalDateKey = dateKeyInTimezone(
      new Date(now),
      'America/Vancouver',
    );
    const currentMonthHasWeeklyPeriod = buildCompetitionPeriods(
      currentMonthKey,
    ).some(
      (period) =>
        regionalDateKey >= period.startDateKey &&
        regionalDateKey <= period.endDateKey,
    );
    const monthKey = currentMonthHasWeeklyPeriod
      ? currentMonthKey
      : monthKeyFormatter.format(new Date(now + 7 * 24 * 60 * 60_000));
    const fixtureSequence = ++registrationFixtureSequence;
    const user = await profiles.ensureUser(principal, database.connection);
    const legalReceiptBundleId = await acceptCurrentLegalBundle(
      principal,
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
       VALUES ($1, $2, 'device_location', 'approved', '{}'::jsonb,
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
       VALUES ($1, $2, 'Critical Session Competition', 'registration',
               'rules-v1', $3::jsonb, 100, $4, $5, $6, $7)
       RETURNING id`,
      [
        region.rows[0].id,
        monthKey,
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
         (competition_id, gym_location_id, credential_version, token_hash, status,
          issued_by_user_id, expires_at)
       VALUES ($1, $2, 1, $3, 'active', $4, current_timestamp + interval '30 days')`,
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
      monthKey,
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
         VALUES ($1, $2, 'device_location', 'approved', '{}'::jsonb,
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
         (competition_id, gym_location_id, credential_version, token_hash, status,
          issued_by_user_id, expires_at)
       VALUES ($1, $2, 1, $3, 'active', $4, current_timestamp + interval '30 days')`,
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
          policy_version, verified_at, expires_at)
       SELECT id, $1, 'device_location', 'approved', '{}'::jsonb,
              'policy-v1', current_timestamp, current_timestamp + interval '1 day'
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
    const client = await migrated.pool.connect();
    const startedAt = new Date(Date.now() - 11 * 60_000);
    try {
      await client.query('BEGIN');
      // Simulate elapsed server time without weakening the production identity
      // triggers; keep enrollment time and the regional date internally valid.
      await client.query("SET LOCAL session_replication_role = 'replica'");
      const session = await client.query<{ enrollment_id: string }>(
        `UPDATE workout_sessions AS session
         SET started_at = $1,
             eligible_date = ($1::timestamptz AT TIME ZONE region.timezone)::date,
             updated_at = $1
         FROM competitions AS competition
         INNER JOIN region_policies AS region
           ON region.id = competition.region_policy_id
         WHERE session.id = $2
           AND competition.id = session.competition_id
         RETURNING session.enrollment_id`,
        [startedAt, sessionId],
      );
      await client.query(
        `UPDATE competition_enrollments
         SET enrolled_at = LEAST(enrolled_at, $1::timestamptz - INTERVAL '1 minute')
         WHERE id = $2`,
        [startedAt, session.rows[0].enrollment_id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
