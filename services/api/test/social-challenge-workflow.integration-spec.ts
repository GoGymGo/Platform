import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { dateKeyInTimezone } from '../src/modules/competitions/competition-calendar';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { SocialService } from '../src/modules/social/social.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

function principal(name: string): AuthenticatedPrincipal {
  return {
    email: `${name}@integration.test`,
    emailVerified: true,
    firebaseUid: `social-${name}`,
    roles: ['user'],
    tokenIssuedAt: 1,
  };
}

describeWithDatabase('social friend and challenge workflow', () => {
  jest.setTimeout(120_000);

  const alice = principal('alice');
  const bob = principal('bob');
  const charlie = principal('charlie');
  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let profiles: ProfilesService;
  let social: SocialService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    profiles = new ProfilesService(database);
    social = new SocialService(
      database,
      new IdempotencyService(database),
      profiles,
    );

    await migrated.pool.query(`
      INSERT INTO region_policies (
        code,
        country_code,
        subdivision_code,
        metro_name,
        currency,
        timezone,
        language_codes,
        minimum_age,
        competition_enabled,
        boundary_version,
        policy_version,
        boundary,
        valid_from
      ) VALUES (
        'toronto-on',
        'CA',
        'ON',
        'Toronto',
        'CAD',
        'America/Toronto',
        ARRAY['en'],
        18,
        true,
        'social-test-v1',
        'social-test-v1',
        ST_GeogFromText(
          'SRID=4326;MULTIPOLYGON(((-79.8 43.4,-79.0 43.4,-79.0 44.0,-79.8 44.0,-79.8 43.4)))'
        ),
        now() - interval '1 day'
      )
    `);

    await profiles.updateMe(alice, { screenName: 'ALICE_LIFTS' });
    await profiles.updateMe(bob, { screenName: 'BOB_TRAINS' });
    await profiles.updateMe(charlie, { screenName: 'CHARLIE_MOVES' });
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('requires friend consent before an idempotent challenge invitation', async () => {
    const aliceProfile = await profiles.getMe(alice);
    const bobProfile = await profiles.getMe(bob);
    const charlieProfile = await profiles.getMe(charlie);

    await expect(
      profiles.updateMe(charlie, { screenName: 'alice_lifts' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SCREEN_NAME_TAKEN' }),
    });

    await expect(
      social.searchUsers(alice, { screenName: 'bob' }),
    ).resolves.toEqual([
      expect.objectContaining({
        relationship: 'none',
        screenName: 'BOB_TRAINS',
        userId: bobProfile.id,
      }),
    ]);

    const request = await social.sendFriendRequest(
      alice,
      'social-friend-alice-bob',
      bobProfile.id,
    );
    const retry = await social.sendFriendRequest(
      alice,
      'social-friend-alice-bob',
      bobProfile.id,
    );
    expect(retry).toEqual(request);
    await expect(
      social.sendFriendRequest(
        bob,
        'social-friend-reverse-bob',
        aliceProfile.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INCOMING_FRIEND_REQUEST_PENDING',
      }),
    });

    await social.respondToFriendRequest(
      bob,
      'social-friend-accept-bob',
      request.id,
      { decision: 'accepted' },
    );
    await expect(social.listFriends(alice)).resolves.toEqual([
      expect.objectContaining({
        screenName: 'BOB_TRAINS',
        userId: bobProfile.id,
      }),
    ]);

    const challenge = await social.createChallenge(
      alice,
      'social-challenge-july',
      {
        activity: 'gym',
        activityLabel: 'Gym visits',
        challengeType: 'friend',
        description: 'Four verified workouts each week.',
        endDate: '2026-07-31',
        invitedFriendUserIds: [bobProfile.id],
        name: '  July   Strength Sprint  ',
        scheduledDays: [],
        startDate: '2026-07-01',
        targetCount: 4,
        targetPeriod: 'weekly',
      },
    );
    const challengeRetry = await social.createChallenge(
      alice,
      'social-challenge-july',
      {
        activity: 'gym',
        activityLabel: 'Gym visits',
        challengeType: 'friend',
        description: 'Four verified workouts each week.',
        endDate: '2026-07-31',
        invitedFriendUserIds: [bobProfile.id],
        name: 'July Strength Sprint',
        scheduledDays: [],
        startDate: '2026-07-01',
        targetCount: 4,
        targetPeriod: 'weekly',
      },
    );
    expect(challengeRetry).toEqual(challenge);
    expect(challenge).toEqual(
      expect.objectContaining({
        myRole: 'owner',
        myStatus: 'accepted',
        name: 'July Strength Sprint',
      }),
    );

    await expect(
      social.inviteFriendToChallenge(
        alice,
        'social-invite-charlie',
        challenge.id,
        { friendUserId: charlieProfile.id },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCEPTED_FRIEND_REQUIRED' }),
    });

    await expect(social.listChallenges(bob)).resolves.toEqual([
      expect.objectContaining({ id: challenge.id, myStatus: 'pending' }),
    ]);

    await social.respondToChallengeInvitation(
      bob,
      'social-invite-accept-bob',
      challenge.id,
      { decision: 'accepted' },
    );
    await expect(social.listChallenges(bob)).resolves.toEqual([
      expect.objectContaining({
        id: challenge.id,
        members: expect.arrayContaining([
          expect.objectContaining({
            status: 'accepted',
            userId: bobProfile.id,
          }),
        ]),
        myStatus: 'accepted',
      }),
    ]);

    const counts = await migrated.pool.query<{
      challenges: number;
      friendships: number;
      memberships: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM friendships) AS friendships,
         (SELECT count(*)::integer FROM social_challenges) AS challenges,
         (SELECT count(*)::integer FROM social_challenge_members) AS memberships`,
    );
    expect(counts.rows[0]).toEqual({
      challenges: 1,
      friendships: 1,
      memberships: 2,
    });
  });

  it('publishes, discovers, joins, and tracks a regional activity challenge', async () => {
    const challengeDate = dateKeyInTimezone(new Date(), 'America/Toronto');
    const challenge = await social.createChallenge(
      alice,
      'social-regional-run',
      {
        activity: 'running',
        activityLabel: '5K group run',
        challengeType: 'regional',
        description: 'Meet at the trail entrance for an easy social 5K.',
        endDate: challengeDate,
        invitedFriendUserIds: [],
        locationName: 'Waterfront Trail entrance',
        name: 'Waterfront Run Club',
        participantLimit: 3,
        regionCode: 'toronto-on',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        scheduledTime: '18:30',
        startDate: challengeDate,
        targetCount: 1,
        targetPeriod: 'monthly',
      },
    );

    await expect(
      social.discoverChallenges(charlie, { regionCode: 'toronto-on' }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: challenge.id,
        myRole: null,
        myStatus: 'not_joined',
        participantCount: 1,
        regionCode: 'toronto-on',
      }),
    ]);

    await social.joinRegionalChallenge(
      charlie,
      'social-regional-run-join',
      challenge.id,
    );
    const checkIn = await social.checkInToChallenge(
      charlie,
      'social-regional-run-check-in',
      challenge.id,
    );
    expect(checkIn).toEqual(
      expect.objectContaining({
        challengeId: challenge.id,
        eligibleDate: challengeDate,
        source: 'manual',
      }),
    );
    await expect(social.listChallenges(charlie)).resolves.toEqual([
      expect.objectContaining({
        id: challenge.id,
        myProgress: {
          completedCount: 1,
          completionPercent: 100,
          targetTotal: 1,
        },
        myStatus: 'accepted',
        participantCount: 2,
      }),
    ]);
  });
});
