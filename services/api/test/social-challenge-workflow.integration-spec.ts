import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { dateKeyInTimezone } from '../src/modules/competitions/competition-calendar';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { PrivacyExportBuilder } from '../src/modules/privacy/privacy-export.builder';
import { PrivacyOperationsRepository } from '../src/modules/privacy/privacy-operations.repository';
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

    const challenge = await social.createChallenge(
      dave,
      'dave-private-link-challenge',
      {
        activity: 'gym',
        activityLabel: 'Gym visits',
        challengeType: 'friend',
        endDate: '2026-08-31',
        invitedFriendUserIds: [],
        name: 'Private Link Challenge',
        scheduledDays: [],
        startDate: '2026-08-01',
        targetCount: 4,
        targetPeriod: 'weekly',
      },
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
      ]),
    );

    const leaseToken = '90000000-0000-4000-8000-000000000009';
    const deletionRequest = await database.connection
      .insertInto('privacy_requests')
      .values({
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
    const deletionJob = {
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
        schemaVersion: 9,
        socialData: expect.objectContaining({
          challengeContactInvitations: [
            expect.objectContaining({
              channel: 'email',
              destination_hint: 'e***@integration.test',
              status: 'claimed',
            }),
          ],
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
        challenge.id,
        daveProfile.id,
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

    await new PrivacyOperationsRepository(database).completeDeletion(
      deletionJob,
      `deleted:${'a'.repeat(64)}`,
      'GG-DELETED-ABCDEF123456',
    );
    const deletionCounts = await migrated.pool.query<{
      blocks: number;
      contact_invitations: number;
      relationship_events: number;
    }>(
      `SELECT
        (SELECT count(*)::integer FROM user_blocks
          WHERE blocker_user_id = $1 OR blocked_user_id = $1) AS blocks,
        (SELECT count(*)::integer FROM challenge_contact_invitations
          WHERE inviter_user_id = $1 OR claimed_by_user_id = $1) AS contact_invitations,
        (SELECT count(*)::integer FROM social_relationship_events
          WHERE actor_user_id = $1 OR subject_user_id = $1) AS relationship_events`,
      [daveProfile.id],
    );
    expect(deletionCounts.rows[0]).toEqual({
      blocks: 0,
      contact_invitations: 0,
      relationship_events: expect.any(Number),
    });
    expect(deletionCounts.rows[0].relationship_events).toBeGreaterThan(0);
  });
});
