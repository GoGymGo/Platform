import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { dateKeyInTimezone } from '../src/modules/competitions/competition-calendar';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { PrivacyExportBuilder } from '../src/modules/privacy/privacy-export.builder';
import { PrivacyOperationsRepository } from '../src/modules/privacy/privacy-operations.repository';
import type { ClaimedPrivacyJob } from '../src/modules/privacy/privacy-operations.types';
import { SocialService } from '../src/modules/social/social.service';
import { SocialInvitationCleanupService } from '../src/modules/social/social-invitation-cleanup.service';
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
    signInProvider: 'password',
    tokenIssuedAt: 1,
  };
}

function addDateKeyDays(dateKey: string, days: number) {
  const value = new Date(`${dateKey}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

describeWithDatabase('social friend and challenge workflow', () => {
  jest.setTimeout(120_000);

  const alice = principal('alice');
  const bob = principal('bob');
  const charlie = principal('charlie');
  const dave = principal('dave');
  const erin = principal('erin');
  const frank = principal('frank');
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

    for (const [member, alias] of [
      [alice, 'ALICE_LIFTS'],
      [bob, 'BOB_TRAINS'],
      [charlie, 'CHARLIE_MOVES'],
      [dave, 'DAVE_LIFTS'],
      [erin, 'ERIN_TRAINS'],
      [frank, 'FRANK_MOVES'],
    ] as const) {
      await profiles.updateMe(member, {
        publicIdentityMode: 'alias',
        publicName: alias,
        screenName: alias,
      });
    }

    await migrated.pool.query(
      `INSERT INTO region_verifications (
        user_id, region_policy_id, method, status, evidence_metadata,
        policy_version, verified_at, expires_at
      )
      SELECT users.id, policy.id, 'device_location', 'approved', '{}'::jsonb,
             policy.policy_version, now(), now() + interval '1 day'
      FROM users
      INNER JOIN region_policies AS policy ON policy.code = 'toronto-on'
      WHERE users.firebase_uid = ANY($1::text[])`,
      [
        [alice, bob, charlie, dave, erin, frank].map(
          ({ firebaseUid }) => firebaseUid,
        ),
      ],
    );
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

    const challengeDate = dateKeyInTimezone(new Date(), 'America/Toronto');
    const challengeEndDate = addDateKeyDays(challengeDate, 6);
    const challenge = await social.createChallenge(
      alice,
      'social-challenge-july',
      {
        activity: 'gym',
        activityLabel: 'Gym visits',
        challengeType: 'friend',
        description: 'Four verified workouts each week.',
        endDate: challengeEndDate,
        invitedFriendUserIds: [bobProfile.id],
        name: '  July   Strength Sprint  ',
        scheduledDays: [],
        startDate: challengeDate,
        targetCount: 4,
        targetPeriod: 'weekly',
        timezone: 'America/Toronto',
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
        endDate: challengeEndDate,
        invitedFriendUserIds: [bobProfile.id],
        name: 'July Strength Sprint',
        scheduledDays: [],
        startDate: challengeDate,
        targetCount: 4,
        targetPeriod: 'weekly',
        timezone: 'America/Toronto',
      },
    );
    expect(challengeRetry).toEqual(challenge);
    expect(challenge).toEqual(
      expect.objectContaining({
        myRole: 'owner',
        myStatus: 'accepted',
        name: 'July Strength Sprint',
        ownerScreenName: 'ALICE_LIFTS',
      }),
    );
    await expect(
      social.checkInToChallenge(
        alice,
        'social-gym-check-in-before-verification',
        challenge.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VERIFIED_WORKOUT_REQUIRED' }),
    });

    const competition = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competitions (
        region_policy_id, month_key, name, status, rules_version, rules,
        minimum_entrants, registration_opens_at, registration_closes_at,
        starts_at, ends_at
      )
      SELECT id, $1, 'Social Challenge Workout Fixture', 'active',
             'social-challenge-rules-v1', '{}'::jsonb, 100,
             now() - interval '3 days', now() - interval '2 days',
             now() - interval '1 day', now() + interval '31 days'
      FROM region_policies WHERE code = 'toronto-on'
      RETURNING id`,
      [challengeDate.slice(0, 7)],
    );
    await migrated.pool.query(
      `INSERT INTO competition_goal_brackets (competition_id, goal_days, label)
       VALUES ($1, 4, 'Four days')`,
      [competition.rows[0].id],
    );
    const acceptance = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competition_rule_acceptances (
        competition_id, user_id, rules_version, age_eligibility_attested,
        accepted_at
      ) VALUES ($1, $2, 'social-challenge-rules-v1', true, now())
      RETURNING id`,
      [competition.rows[0].id, aliceProfile.id],
    );
    const enrollment = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competition_enrollments (
        competition_id, user_id, goal_days, region_verification_id,
        rules_acceptance_id, status, enrolled_at
      )
      SELECT $1, $2, 4, verification.id, $3, 'active', now() - interval '1 hour'
      FROM region_verifications AS verification
      WHERE verification.user_id = $2
        AND verification.status = 'approved'
      ORDER BY verification.verified_at DESC
      LIMIT 1
      RETURNING id`,
      [competition.rows[0].id, aliceProfile.id, acceptance.rows[0].id],
    );
    const verifiedWorkout = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions (
        competition_id, enrollment_id, user_id, eligible_date, status,
        policy_version, started_at, completed_at, verification_summary
      ) VALUES ($1, $2, $3, $4, 'verified', 'social-challenge-rules-v1',
                now() - interval '30 minutes', now(), '{"fixture":true}'::jsonb)
      RETURNING id`,
      [
        competition.rows[0].id,
        enrollment.rows[0].id,
        aliceProfile.id,
        challengeDate,
      ],
    );
    await expect(
      social.checkInToChallenge(
        alice,
        'social-gym-check-in-after-verification',
        challenge.id,
      ),
    ).resolves.toEqual(expect.objectContaining({ source: 'verified_workout' }));
    await expect(
      migrated.pool.query('DELETE FROM workout_sessions WHERE id = $1', [
        verifiedWorkout.rows[0].id,
      ]),
    ).rejects.toMatchObject({ code: '23503' });

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
            screenName: 'BOB_TRAINS',
            status: 'accepted',
          }),
        ]),
        myStatus: 'accepted',
      }),
    ]);
    expect(JSON.stringify(await social.listChallenges(bob))).not.toContain(
      bobProfile.id,
    );

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
    await social.removeFriend(
      alice,
      'social-friend-remove-alice-bob',
      bobProfile.id,
    );
    const removedMembership = await migrated.pool.query<{ status: string }>(
      `SELECT status::text FROM social_challenge_members
       WHERE challenge_id = $1 AND user_id = $2`,
      [challenge.id, bobProfile.id],
    );
    expect(removedMembership.rows[0]?.status).toBe('withdrawn');
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

    const unverified = principal('unverified');
    await profiles.updateMe(unverified, {
      publicIdentityMode: 'alias',
      publicName: 'UNVERIFIED_LOCAL',
      screenName: 'UNVERIFIED_LOCAL',
    });
    await expect(
      social.discoverChallenges(unverified, { regionCode: 'toronto-on' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'APPROVED_REGION_VERIFICATION_REQUIRED',
      }),
    });

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
    const creditBefore = await migrated.pool.query<{
      competition_progress: number;
      draw_entries: number;
      entry_ledger: number;
      reward_awards: number;
      session_events: number;
      workout_sessions: number;
    }>(`SELECT
      (SELECT count(*)::integer FROM workout_sessions) AS workout_sessions,
      (SELECT count(*)::integer FROM session_events) AS session_events,
      (SELECT count(*)::integer FROM entry_ledger) AS entry_ledger,
      (SELECT count(*)::integer FROM competition_progress) AS competition_progress,
      (SELECT count(*)::integer FROM draw_entries) AS draw_entries,
      (SELECT count(*)::integer FROM reward_awards) AS reward_awards`);
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
    const retry = await social.checkInToChallenge(
      charlie,
      'social-regional-run-check-in-retry',
      challenge.id,
    );
    expect(retry).toEqual(checkIn);
    const creditAfter = await migrated.pool.query<{
      competition_progress: number;
      draw_entries: number;
      entry_ledger: number;
      reward_awards: number;
      session_events: number;
      workout_sessions: number;
    }>(`SELECT
      (SELECT count(*)::integer FROM workout_sessions) AS workout_sessions,
      (SELECT count(*)::integer FROM session_events) AS session_events,
      (SELECT count(*)::integer FROM entry_ledger) AS entry_ledger,
      (SELECT count(*)::integer FROM competition_progress) AS competition_progress,
      (SELECT count(*)::integer FROM draw_entries) AS draw_entries,
      (SELECT count(*)::integer FROM reward_awards) AS reward_awards`);
    expect(creditAfter.rows[0]).toEqual(creditBefore.rows[0]);
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

    const capacityRace = await Promise.allSettled([
      social.joinRegionalChallenge(
        dave,
        'social-regional-capacity-dave',
        challenge.id,
      ),
      social.joinRegionalChallenge(
        erin,
        'social-regional-capacity-erin',
        challenge.id,
      ),
    ]);
    expect(
      capacityRace.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      capacityRace.filter(({ status }) => status === 'rejected'),
    ).toHaveLength(1);
    await expect(
      social.cancelChallenge(
        charlie,
        'social-regional-cancel-non-owner',
        challenge.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CHALLENGE_NOT_FOUND' }),
    });
    await expect(
      social.withdrawFromChallenge(
        charlie,
        'social-regional-withdraw-charlie',
        challenge.id,
      ),
    ).resolves.toEqual({ challengeId: challenge.id, status: 'withdrawn' });
    await expect(social.listChallenges(charlie)).resolves.toEqual([]);
  });

  it('enforces cancellation, blocks, and one-time destination-bound links', async () => {
    const daveProfile = await profiles.getMe(dave);
    const erinProfile = await profiles.getMe(erin);
    const frankProfile = await profiles.getMe(frank);

    await expect(
      profiles.updateMe(frank, { screenName: 'SUPPORT_TEAM' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SCREEN_NAME_INVALID' }),
    });
    await expect(
      social.searchUsers(dave, { screenName: 'train' }),
    ).resolves.toEqual([]);
    await expect(
      social.searchUsers(dave, { screenName: 'erin_' }),
    ).resolves.toEqual([
      expect.objectContaining({
        screenName: 'ERIN_TRAINS',
        userId: erinProfile.id,
      }),
    ]);

    const request = await social.sendFriendRequest(
      dave,
      'dave-erin-request-cancel',
      erinProfile.id,
    );
    await expect(
      social.cancelFriendRequest(
        erin,
        'erin-cannot-cancel-dave-request',
        request.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FRIEND_REQUEST_NOT_FOUND' }),
    });
    await expect(
      social.cancelFriendRequest(dave, 'dave-cancel-request', request.id),
    ).resolves.toEqual({
      action: 'cancelled',
      requestId: request.id,
      userId: erinProfile.id,
    });

    const pending = await social.sendFriendRequest(
      dave,
      'dave-erin-request-block',
      erinProfile.id,
    );
    await social.blockMember(dave, 'dave-block-erin', erinProfile.id);
    await expect(social.listFriendRequests(erin)).resolves.toEqual([]);
    await expect(
      social.searchUsers(erin, { screenName: 'dave' }),
    ).resolves.toEqual([]);
    await expect(
      migrated.pool.query(
        `INSERT INTO friend_requests (
          requester_user_id, recipient_user_id, status, created_at, updated_at
        ) VALUES ($1, $2, 'pending', now(), now())`,
        [erinProfile.id, daveProfile.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      social.sendFriendRequest(
        erin,
        'erin-request-blocked-dave',
        daveProfile.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SOCIAL_MEMBER_NOT_AVAILABLE',
      }),
    });
    const cancelledRequest = await migrated.pool.query<{ status: string }>(
      'SELECT status::text FROM friend_requests WHERE id = $1',
      [pending.id],
    );
    expect(cancelledRequest.rows[0]?.status).toBe('cancelled');
    await social.unblockMember(dave, 'dave-unblock-erin', erinProfile.id);

    const blockRace = await Promise.allSettled([
      social.blockMember(dave, 'dave-block-request-race', erinProfile.id),
      social.sendFriendRequest(
        erin,
        'erin-request-during-block-race',
        daveProfile.id,
      ),
    ]);
    expect(blockRace[0]?.status).toBe('fulfilled');
    const racedState = await migrated.pool.query<{
      block_count: number;
      pending_count: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM user_blocks
          WHERE blocker_user_id = $1 AND blocked_user_id = $2) AS block_count,
         (SELECT count(*)::integer FROM friend_requests
          WHERE status = 'pending'
            AND LEAST(requester_user_id, recipient_user_id) = LEAST($1::uuid, $2::uuid)
            AND GREATEST(requester_user_id, recipient_user_id) = GREATEST($1::uuid, $2::uuid)) AS pending_count`,
      [daveProfile.id, erinProfile.id],
    );
    expect(racedState.rows[0]).toEqual({
      block_count: 1,
      pending_count: 0,
    });
    await social.unblockMember(
      dave,
      'dave-unblock-request-race',
      erinProfile.id,
    );

    const crossed = await Promise.allSettled([
      social.sendFriendRequest(dave, 'dave-crossed-request', erinProfile.id),
      social.sendFriendRequest(erin, 'erin-crossed-request', daveProfile.id),
    ]);
    expect(
      crossed.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      crossed.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const pendingPairs = await migrated.pool.query<{ count: number }>(
      `SELECT count(*)::integer
       FROM friend_requests
       WHERE status = 'pending'
         AND LEAST(requester_user_id, recipient_user_id) = LEAST($1::uuid, $2::uuid)
         AND GREATEST(requester_user_id, recipient_user_id) = GREATEST($1::uuid, $2::uuid)`,
      [daveProfile.id, erinProfile.id],
    );
    expect(pendingPairs.rows[0]?.count).toBe(1);
    await social.blockMember(
      dave,
      'dave-block-crossed-request',
      erinProfile.id,
    );
    await social.unblockMember(
      dave,
      'dave-unblock-crossed-request',
      erinProfile.id,
    );

    const challengeDate = dateKeyInTimezone(new Date(), 'America/Toronto');
    const challenge = await social.createChallenge(
      dave,
      'dave-private-link-challenge',
      {
        activity: 'walking',
        activityLabel: 'Walking',
        challengeType: 'friend',
        endDate: addDateKeyDays(challengeDate, 6),
        invitedContacts: [{ channel: 'phone', destination: '+1 250 555 0198' }],
        invitedFriendUserIds: [],
        name: 'Private Link Challenge',
        scheduledDays: [],
        startDate: challengeDate,
        targetCount: 4,
        targetPeriod: 'weekly',
        timezone: 'America/Toronto',
      },
    );
    expect(challenge.contactInvitations).toEqual([
      expect.objectContaining({
        channel: 'phone',
        deliveryMode: 'link',
        deliveryStatus: 'not_sent',
      }),
    ]);
    const atomicToken = new URL(
      challenge.contactInvitations[0].joinUrl,
    ).searchParams.get('challengeInvite');
    await social.checkInToChallenge(
      dave,
      'dave-private-link-manual-check-in',
      challenge.id,
    );
    const firstInvitation = await social.inviteContactToChallenge(
      dave,
      'dave-private-link',
      challenge.id,
      { channel: 'email', destination: ' ERIN@INTEGRATION.TEST ' },
    );
    const firstToken = new URL(firstInvitation.joinUrl).searchParams.get(
      'challengeInvite',
    );
    const invitation = await social.inviteContactToChallenge(
      dave,
      'dave-private-link',
      challenge.id,
      { channel: 'email', destination: 'erin@integration.test' },
    );
    expect(invitation.id).not.toBe(firstInvitation.id);
    await expect(
      social.inspectContactInvitation(erin, firstToken!),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
      }),
    });
    expect(invitation).toEqual(
      expect.objectContaining({
        channel: 'email',
        deliveryMode: 'link',
        deliveryStatus: 'not_sent',
        destinationHint: 'e***@integration.test',
      }),
    );
    expect(invitation).not.toHaveProperty('destination');
    const token = new URL(invitation.joinUrl).searchParams.get(
      'challengeInvite',
    );
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    await expect(
      social.inspectContactInvitation(erin, token!),
    ).resolves.toEqual(
      expect.objectContaining({
        channel: 'email',
        destinationHint: 'e***@integration.test',
      }),
    );
    await expect(
      social.redeemContactInvitation(frank, 'frank-wrong-destination', token!),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
      }),
    });
    await expect(
      social.redeemContactInvitation(erin, 'erin-redeem-private-link', token!),
    ).resolves.toEqual(
      expect.objectContaining({
        challengeId: challenge.id,
        status: 'accepted',
      }),
    );
    await expect(
      social.redeemContactInvitation(erin, 'erin-replay-private-link', token!),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CHALLENGE_CONTACT_INVITATION_RESOLVED',
      }),
    });

    const stored = await migrated.pool.query<{
      creation_key_hash: string;
      destination_hash: string;
      invite_token_hash: string;
      status: string;
    }>(
      `SELECT creation_key_hash, destination_hash, invite_token_hash, status::text
       FROM challenge_contact_invitations WHERE id = $1`,
      [invitation.id],
    );
    expect(stored.rows[0]).toEqual({
      creation_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      destination_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      invite_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      status: 'claimed',
    });
    expect(JSON.stringify(stored.rows[0])).not.toContain(token!);
    expect(JSON.stringify(stored.rows[0])).not.toContain(
      'erin@integration.test',
    );
    await social.blockMember(
      dave,
      'dave-block-challenge-member',
      erinProfile.id,
    );
    const blockedMembership = await migrated.pool.query<{ status: string }>(
      `SELECT status::text FROM social_challenge_members
       WHERE challenge_id = $1 AND user_id = $2`,
      [challenge.id, erinProfile.id],
    );
    expect(blockedMembership.rows[0]?.status).toBe('withdrawn');
    await social.unblockMember(
      dave,
      'dave-unblock-challenge-member',
      erinProfile.id,
    );
    await expect(
      social.cancelChallenge(
        dave,
        'dave-cancel-private-link-challenge',
        challenge.id,
      ),
    ).resolves.toEqual({ challengeId: challenge.id, state: 'cancelled' });
    await expect(
      social.inspectContactInvitation(erin, atomicToken!),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CHALLENGE_CONTACT_INVITATION_NOT_FOUND',
      }),
    });
    await expect(social.listChallenges(dave)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: challenge.id, state: 'cancelled' }),
      ]),
    );

    const events = await migrated.pool.query<{ action: string }>(
      `SELECT action FROM social_relationship_events
       WHERE actor_user_id = $1 ORDER BY created_at`,
      [daveProfile.id],
    );
    expect(events.rows.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'friend_request_cancelled',
        'friend_request_sent',
        'member_blocked',
        'member_unblocked',
        'challenge_cancelled',
        'challenge_checkin_recorded',
      ]),
    );

    const leaseToken = '90000000-0000-4000-8000-000000000009';
    const deletionRequest = await database.connection
      .insertInto('privacy_requests')
      .values({
        attempt_count: 1,
        confirmation_code: 'DELETE_MY_ACCOUNT',
        confirmed_at: new Date(),
        lease_expires_at: new Date(Date.now() + 60_000),
        lease_token: leaseToken,
        next_attempt_at: new Date(),
        processing_started_at: new Date(),
        reason: null,
        request_type: 'delete',
        status: 'processing',
        user_id: daveProfile.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    let deletionJob: ClaimedPrivacyJob = {
      attemptCount: 1,
      id: deletionRequest.id,
      leaseToken,
      requestType: 'delete' as const,
      userId: daveProfile.id,
    };
    const privacyExport = await new PrivacyExportBuilder(database).build(
      deletionJob,
    );
    expect(privacyExport).toEqual(
      expect.objectContaining({
        schemaVersion: 14,
        socialData: expect.objectContaining({
          challengeCheckIns: [
            expect.objectContaining({
              eligible_date: challengeDate,
              verifiedWorkoutLinked: false,
            }),
          ],
          challengeContactInvitations: expect.arrayContaining([
            expect.objectContaining({
              channel: 'email',
              destination_hint: 'e***@integration.test',
              status: 'claimed',
            }),
          ]),
          relationshipEvents: expect.arrayContaining([
            expect.objectContaining({ action: 'member_blocked' }),
          ]),
        }),
      }),
    );
    expect(JSON.stringify(privacyExport)).not.toContain(token!);
    expect(JSON.stringify(privacyExport)).not.toContain(
      'erin@integration.test',
    );
    expect(JSON.stringify(privacyExport)).not.toContain(
      stored.rows[0].destination_hash,
    );
    expect(JSON.stringify(privacyExport.socialData)).not.toContain(
      'workout_session_id',
    );

    const cleanupChallenge = await migrated.pool.query<{
      id: string;
      owner_user_id: string;
    }>(
      `SELECT id, owner_user_id
       FROM social_challenges
       WHERE name = 'July Strength Sprint' AND status = 'active'`,
    );
    const cleanupChallengeRow = cleanupChallenge.rows[0];
    if (!cleanupChallengeRow) {
      throw new Error('Expected the active friend Challenge cleanup fixture');
    }
    await migrated.pool.query(
      `INSERT INTO challenge_contact_invitations (
        challenge_id, inviter_user_id, channel, destination_hash,
        destination_hint, delivery_mode, creation_key_hash,
        invite_token_hash, token_version, status, expires_at,
        claimed_by_user_id, created_at, claimed_at
      ) VALUES
        ($1, $2, 'phone', $3, '••••0199', 'link', $4, $5, 1,
          'pending', now() - interval '1 day', null,
          now() - interval '32 days', null),
        ($1, $2, 'email', $6, 'f***@integration.test', 'link', $7, $8, 1,
          'claimed', now() - interval '92 days', $9,
          now() - interval '123 days', now() - interval '91 days')`,
      [
        cleanupChallengeRow.id,
        cleanupChallengeRow.owner_user_id,
        '1'.repeat(64),
        '2'.repeat(64),
        '3'.repeat(64),
        '4'.repeat(64),
        '5'.repeat(64),
        '6'.repeat(64),
        frankProfile.id,
      ],
    );
    const cleanup = await new SocialInvitationCleanupService(
      database,
    ).process();
    expect(cleanup).toEqual({ expired: 1, purged: 1 });
    const expiredMetadata = await migrated.pool.query<{ status: string }>(
      `SELECT status::text FROM challenge_contact_invitations
       WHERE creation_key_hash = $1`,
      ['2'.repeat(64)],
    );
    expect(expiredMetadata.rows[0]?.status).toBe('expired');

    const privacyOperations = new PrivacyOperationsRepository(database);
    await database.connection
      .updateTable('privacy_requests')
      .set({ lease_expires_at: new Date(Date.now() + 60 * 60_000) })
      .where('status', '=', 'processing')
      .where('id', '!=', deletionJob.id)
      .execute();
    await database.connection
      .updateTable('privacy_requests')
      .set({ lease_expires_at: new Date(Date.now() - 1_000) })
      .where('id', '=', deletionJob.id)
      .executeTakeFirstOrThrow();
    await expect(
      privacyOperations.completeDeletion(
        deletionJob,
        `deleted:${'a'.repeat(64)}`,
        'GG-DELETED-ABCDEF123456',
      ),
    ).rejects.toMatchObject({ code: 'PRIVACY_JOB_LEASE_LOST' });
    const beforeTakeover = await database.connection
      .selectFrom('users')
      .select('status')
      .where('id', '=', daveProfile.id)
      .executeTakeFirstOrThrow();
    expect(beforeTakeover.status).toBe('active');
    const reclaimed = await privacyOperations.claimNext(new Date(), 600);
    expect(reclaimed).toEqual(
      expect.objectContaining({
        attemptCount: 2,
        id: deletionJob.id,
        requestType: 'delete',
      }),
    );
    if (!reclaimed) {
      throw new Error('Expected the expired deletion lease to be reclaimed');
    }
    expect(reclaimed.leaseToken).not.toBe(deletionJob.leaseToken);
    deletionJob = reclaimed;

    await privacyOperations.completeDeletion(
      deletionJob,
      `deleted:${'a'.repeat(64)}`,
      'GG-DELETED-ABCDEF123456',
    );
    const deletionCounts = await migrated.pool.query<{
      blocks: number;
      challenge_checkins: number;
      contact_invitations: number;
      relationship_events: number;
    }>(
      `SELECT
        (SELECT count(*)::integer FROM user_blocks
          WHERE blocker_user_id = $1 OR blocked_user_id = $1) AS blocks,
        (SELECT count(*)::integer FROM social_challenge_checkins
          WHERE user_id = $1) AS challenge_checkins,
        (SELECT count(*)::integer FROM challenge_contact_invitations
          WHERE inviter_user_id = $1 OR claimed_by_user_id = $1) AS contact_invitations,
        (SELECT count(*)::integer FROM social_relationship_events
          WHERE actor_user_id = $1 OR subject_user_id = $1) AS relationship_events`,
      [daveProfile.id],
    );
    expect(deletionCounts.rows[0]).toEqual({
      blocks: 0,
      challenge_checkins: 0,
      contact_invitations: 0,
      relationship_events: expect.any(Number),
    });
    expect(deletionCounts.rows[0].relationship_events).toBeGreaterThan(0);
  });

  it('enforces bounded creation and provenance at the database boundary', async () => {
    const today = dateKeyInTimezone(new Date(), 'America/Toronto');
    const frankProfile = await profiles.getMe(frank);
    try {
      void social.createChallenge(frank, 'empty-friend-challenge', {
        activity: 'walking',
        activityLabel: 'Walking',
        challengeType: 'friend',
        endDate: today,
        invitedFriendUserIds: [],
        name: 'Empty Friend Challenge',
        scheduledDays: [],
        startDate: today,
        targetCount: 1,
        targetPeriod: 'weekly',
        timezone: 'America/Toronto',
      });
      throw new Error('Expected empty friend challenge validation to fail.');
    } catch (error) {
      expect(error).toMatchObject({
        response: expect.objectContaining({
          code: 'FRIEND_CHALLENGE_INVITATION_REQUIRED',
        }),
      });
    }
    try {
      void social.createChallenge(frank, 'long-friend-challenge', {
        activity: 'walking',
        activityLabel: 'Walking',
        challengeType: 'friend',
        endDate: addDateKeyDays(today, 31),
        invitedContacts: [
          { channel: 'email', destination: 'new@example.test' },
        ],
        invitedFriendUserIds: [],
        name: 'Too Long Friend Challenge',
        scheduledDays: [],
        startDate: today,
        targetCount: 1,
        targetPeriod: 'weekly',
        timezone: 'America/Toronto',
      });
      throw new Error('Expected long challenge validation to fail.');
    } catch (error) {
      expect(error).toMatchObject({
        response: expect.objectContaining({ code: 'CHALLENGE_WINDOW_INVALID' }),
      });
    }

    await expect(
      migrated.pool.query(
        `INSERT INTO social_challenges (
          owner_user_id, name, status, activity, activity_label,
          challenge_type, target_count, target_period, start_date, end_date,
          scheduled_days, timezone, created_at, updated_at
        ) VALUES ($1, 'Raw Invalid Window', 'active', 'walking', 'Walking',
                  'friend', 1, 'weekly', $2, $3, ARRAY[]::smallint[],
                  'America/Toronto', now(), now())`,
        [frankProfile.id, today, addDateKeyDays(today, 31)],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      migrated.pool.query(
        `INSERT INTO social_challenge_members (
          challenge_id, user_id, role, status, invited_by_user_id,
          invitation_source, created_at, updated_at
        )
        SELECT challenge.id, $1, 'member', 'pending', challenge.owner_user_id,
               'friend', now(), now()
        FROM social_challenges AS challenge
        WHERE challenge.name = 'July Strength Sprint'`,
        [frankProfile.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    const aliceProfile = await profiles.getMe(alice);
    await expect(
      migrated.pool.query(
        `INSERT INTO social_challenges (
          owner_user_id, name, status, activity, activity_label,
          challenge_type, target_count, target_period, start_date, end_date,
          region_policy_id, location_name, scheduled_days,
          scheduled_time_local, participant_limit, timezone, created_at,
          updated_at
        )
        SELECT $1, 'Duplicate Regional Day', 'active', 'running', 'Running',
               'regional', 1, 'weekly', $2, $2, policy.id, 'Trail',
               ARRAY[1, 1]::smallint[], '09:00', 10, policy.timezone,
               now(), now()
        FROM region_policies AS policy WHERE policy.code = 'toronto-on'`,
        [aliceProfile.id, today],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      migrated.pool.query(
        `INSERT INTO challenge_contact_invitations (
          challenge_id, inviter_user_id, channel, destination_hash,
          destination_hint, delivery_mode, creation_key_hash,
          invite_token_hash, token_version, status, expires_at, created_at
        )
        SELECT challenge.id, $1, 'email', $2, 'n***@example.test', 'link',
               $3, $4, 1, 'pending', now() + interval '1 day', now()
        FROM social_challenges AS challenge
        WHERE challenge.name = 'July Strength Sprint'`,
        [frankProfile.id, '7'.repeat(64), '8'.repeat(64), '9'.repeat(64)],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      migrated.pool.query(
        `INSERT INTO social_challenge_checkins (
          challenge_id, user_id, eligible_date, source, workout_session_id,
          created_at
        )
        SELECT challenge.id, $1, $2, 'manual', null, now()
        FROM social_challenges AS challenge
        WHERE challenge.name = 'July Strength Sprint'`,
        [aliceProfile.id, today],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      migrated.pool.query(
        `UPDATE social_challenges SET name = 'Mutated Challenge'
         WHERE name = 'July Strength Sprint'`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
