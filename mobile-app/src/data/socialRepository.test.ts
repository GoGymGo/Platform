import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSocialRepository } from '@/data/socialRepository';
import type { CreateSocialChallengeInput, SocialChallenge } from '@/domain/social';

const friendChallengeInput: CreateSocialChallengeInput = {
  activity: 'gym',
  activityLabel: 'Gym visits',
  challengeType: 'friend',
  endDate: '2026-07-31',
  invitedFriendUserIds: ['10000000-0000-4000-8000-000000000002'],
  name: 'July Strength Sprint',
  scheduledDays: [],
  startDate: '2026-07-01',
  targetCount: 4,
  targetPeriod: 'weekly'
};

describe('social repository', () => {
  it('runs the consent-based demo friend and challenge workflow', async () => {
    const social = createSocialRepository('demo', null);
    const search = await social.searchUsers('NOVA');

    assert.equal(search[0].relationship, 'incoming_request');
    const incoming = (await social.listFriendRequests()).find(
      ({ direction }) => direction === 'incoming'
    );
    assert.ok(incoming);
    await social.respondToFriendRequest(incoming.id, 'accepted');
    assert.ok((await social.listFriends()).some(({ userId }) => userId === incoming.user.userId));

    const challenge = await social.createChallenge({
      ...friendChallengeInput,
      invitedFriendUserIds: [incoming.user.userId]
    });
    const updated = (await social.listChallenges()).find(({ id }) => id === challenge.id);

    assert.ok(updated?.members.some(
      ({ status, userId }) => userId === incoming.user.userId && status === 'pending'
    ));
  });

  it('maps production methods to the authenticated API contract', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(
        path: string,
        options?: { body?: unknown; method?: string }
      ) => {
        requests.push({ body: options?.body, method: options?.method, path });
        return Promise.resolve({
          activity: 'gym',
          activityLabel: 'Gym visits',
          challengeType: 'friend',
          createdAt: '2026-07-15T00:00:00.000Z',
          description: null,
          endDate: '2026-07-31',
          id: 'challenge-1',
          locationName: null,
          members: [],
          myProgress: { completedCount: 0, completionPercent: 0, targetTotal: 20 },
          myRole: 'owner',
          myStatus: 'accepted',
          name: 'July Strength Sprint',
          ownerScreenName: 'GHOST_RUNNER',
          ownerStreaks: { daily: 6, monthly: 1, weekly: 2, yearly: 0 },
          ownerUserId: 'user-1',
          participantCount: 1,
          participantLimit: null,
          regionCode: null,
          regionName: null,
          scheduledDays: [],
          scheduledTime: null,
          startDate: '2026-07-01',
          targetCount: 4,
          targetPeriod: 'weekly',
          timezone: null
        } as SocialChallenge) as Promise<TResponse>;
      }
    };

    await createSocialRepository('api', api).createChallenge(friendChallengeInput);

    assert.deepEqual(requests[0], {
      body: friendChallengeInput,
      method: 'POST',
      path: '/v1/social/challenges'
    });
  });

  it('saves one alias contract for profile and social surfaces', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(path: string, options?: { body?: unknown; method?: string }) => {
        requests.push({ body: options?.body, method: options?.method, path });
        return Promise.resolve({
          id: 'user-1',
          screenName: 'GHOST_RUNNER'
        }) as Promise<TResponse>;
      }
    };

    const profile = await createSocialRepository('api', api).updateScreenName('GHOST_RUNNER');

    assert.equal(profile.screenName, 'GHOST_RUNNER');
    assert.deepEqual(requests, [
      {
        body: {
          publicIdentityMode: 'alias',
          publicName: 'GHOST_RUNNER',
          screenName: 'GHOST_RUNNER'
        },
        method: 'PATCH',
        path: '/v1/me'
      }
    ]);
  });

  it('maps discovery, joining, and check-ins to regional challenge endpoints', async () => {
    const requests: { method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(path: string, options?: { method?: string }) => {
        requests.push({ method: options?.method, path });
        return Promise.resolve([] as unknown as TResponse);
      }
    };
    const social = createSocialRepository('api', api);

    await social.discoverRegionalChallenges('TORONTO');
    await social.joinRegionalChallenge('challenge-1');
    await social.checkInToChallenge('challenge-1');

    assert.deepEqual(requests, [
      {
        method: undefined,
        path: '/v1/social/challenges/discover?regionCode=TORONTO'
      },
      {
        method: 'POST',
        path: '/v1/social/challenges/challenge-1/join'
      },
      {
        method: 'POST',
        path: '/v1/social/challenges/challenge-1/check-ins'
      }
    ]);
  });

  it('creates a privacy-safe email or phone invitation through the API', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(path: string, options?: { body?: unknown; method?: string }) => {
        requests.push({ body: options?.body, method: options?.method, path });
        return Promise.resolve({
          challengeId: 'challenge-1',
          channel: 'email',
          destinationHint: 'f***@example.com',
          expiresAt: '2026-08-15T00:00:00.000Z',
          id: 'invite-1',
          joinUrl: 'https://gogymgo.com/join?challengeInvite=token'
        }) as Promise<TResponse>;
      }
    };

    await createSocialRepository('api', api).inviteContactToChallenge('challenge-1', {
      channel: 'email',
      destination: 'friend@example.com'
    });
    await createSocialRepository('api', api).redeemContactInvitation('invite-token');

    assert.deepEqual(requests, [
      {
        body: { channel: 'email', destination: 'friend@example.com' },
        method: 'POST',
        path: '/v1/social/challenges/challenge-1/contact-invitations'
      },
      {
        body: { token: 'invite-token' },
        method: 'POST',
        path: '/v1/social/challenge-contact-invitations/redeem'
      }
    ]);
  });
});
