import type { AppDataMode } from '@/data/appData';
import type {
  ChallengeCheckIn,
  ChallengeContactInvitation,
  ChallengeContactInvitationPreview,
  ChallengeInviteContact,
  BlockedMember,
  CreateSocialChallengeInput,
  Friend,
  FriendRequest,
  FriendRequestDecision,
  SocialRelationshipAction,
  SocialChallenge,
  SocialProfile,
  SocialUserSearchResult,
} from '@/domain/social';
import { parseStreakSummary, type StreakSummary } from '@/domain/streaks';
import type { ApiClient } from '@/services/api/client';

type FriendRequestDecisionResponse = {
  requestId: string;
  status: FriendRequestDecision;
};

type ChallengeInvitationResponse = {
  challengeId: string;
  status: 'accepted' | 'declined' | 'pending';
  userId: string;
};

type MeResponse = {
  id: string;
  screenName: string;
};

export type SocialRepository = {
  blockMember: (memberUserId: string) => Promise<SocialRelationshipAction>;
  cancelFriendRequest: (requestId: string) => Promise<SocialRelationshipAction>;
  checkInToChallenge: (challengeId: string) => Promise<ChallengeCheckIn>;
  createChallenge: (
    input: CreateSocialChallengeInput,
  ) => Promise<SocialChallenge>;
  discoverRegionalChallenges: (
    regionCode: string,
  ) => Promise<readonly SocialChallenge[]>;
  getMyProfile: () => Promise<SocialProfile | null>;
  inviteFriendToChallenge: (
    challengeId: string,
    friendUserId: string,
  ) => Promise<ChallengeInvitationResponse>;
  inspectContactInvitation: (
    token: string,
  ) => Promise<ChallengeContactInvitationPreview>;
  inviteContactToChallenge: (
    challengeId: string,
    contact: ChallengeInviteContact,
  ) => Promise<ChallengeContactInvitation>;
  joinRegionalChallenge: (
    challengeId: string,
  ) => Promise<ChallengeInvitationResponse>;
  listChallenges: () => Promise<readonly SocialChallenge[]>;
  listBlocks: () => Promise<readonly BlockedMember[]>;
  listFriendRequests: () => Promise<readonly FriendRequest[]>;
  listFriends: () => Promise<readonly Friend[]>;
  respondToChallengeInvitation: (
    challengeId: string,
    decision: FriendRequestDecision,
  ) => Promise<ChallengeInvitationResponse>;
  redeemContactInvitation: (
    token: string,
    destination?: string,
  ) => Promise<ChallengeInvitationResponse>;
  removeFriend: (friendUserId: string) => Promise<SocialRelationshipAction>;
  respondToFriendRequest: (
    requestId: string,
    decision: FriendRequestDecision,
  ) => Promise<FriendRequestDecisionResponse>;
  searchUsers: (
    screenName: string,
  ) => Promise<readonly SocialUserSearchResult[]>;
  sendFriendRequest: (recipientUserId: string) => Promise<FriendRequest>;
  updateScreenName: (screenName: string) => Promise<SocialProfile>;
  unblockMember: (blockedUserId: string) => Promise<SocialRelationshipAction>;
};

export function createSocialRepository(
  mode: AppDataMode,
  api: ApiClient | null,
): SocialRepository {
  if (mode === 'api') {
    return createApiSocialRepository(requireApi(api));
  }

  return createUnavailableSocialRepository();
}

function createApiSocialRepository(api: ApiClient): SocialRepository {
  const retryKeys = new Map<string, string>();
  const mutate = <T>(
    operation: string,
    request: (key: string) => Promise<T>,
  ) => {
    const idempotencyKey = retryKeys.get(operation) ?? createIdempotencyKey();
    retryKeys.set(operation, idempotencyKey);
    return request(idempotencyKey).then((result) => {
      retryKeys.delete(operation);
      return result;
    });
  };

  return {
    blockMember: (memberUserId) =>
      mutate(`block:${memberUserId}`, (idempotencyKey) =>
        api.request<SocialRelationshipAction, { memberUserId: string }>(
          '/v1/social/blocks',
          {
            body: { memberUserId },
            idempotencyKey,
            method: 'POST',
          },
        ),
      ),
    cancelFriendRequest: (requestId) =>
      mutate(`cancel-friend-request:${requestId}`, (idempotencyKey) =>
        api.request<SocialRelationshipAction>(
          `/v1/social/friend-requests/${encodeURIComponent(requestId)}`,
          { idempotencyKey, method: 'DELETE' },
        ),
      ),
    checkInToChallenge: (challengeId) =>
      mutate(`challenge-check-in:${challengeId}`, (idempotencyKey) =>
        api.request<ChallengeCheckIn>(
          `/v1/social/challenges/${encodeURIComponent(challengeId)}/check-ins`,
          { idempotencyKey, method: 'POST' },
        ),
      ),
    createChallenge: (input) =>
      mutate(
        `create-challenge:${mutationFingerprint(JSON.stringify(input))}`,
        (idempotencyKey) =>
          api.request<SocialChallenge, CreateSocialChallengeInput>(
            '/v1/social/challenges',
            { body: input, idempotencyKey, method: 'POST' },
          ),
      ),
    discoverRegionalChallenges: (regionCode) =>
      api.request<readonly SocialChallenge[]>(
        `/v1/social/challenges/discover?regionCode=${encodeURIComponent(regionCode)}`,
      ),
    getMyProfile: () =>
      Promise.all([
        api.request<MeResponse>('/v1/me'),
        api.request<unknown>('/v1/streaks/me'),
      ]).then(([profile, streaks]) => {
        const parsed = parseStreakSummary(streaks);
      return parsed ? toSocialProfile(profile, parsed) : null;
      }),
    inviteFriendToChallenge: (challengeId, friendUserId) =>
      mutate(
        `challenge-invite:${challengeId}:${friendUserId}`,
        (idempotencyKey) =>
          api.request<ChallengeInvitationResponse, { friendUserId: string }>(
            `/v1/social/challenges/${encodeURIComponent(challengeId)}/invitations`,
            {
              body: { friendUserId },
              idempotencyKey,
              method: 'POST',
            },
          ),
      ),
    inviteContactToChallenge: (challengeId, contact) =>
      mutate(
        `contact-invite:${challengeId}:${contact.channel}:${mutationFingerprint(contact.destination)}`,
        (idempotencyKey) =>
          api.request<ChallengeContactInvitation, ChallengeInviteContact>(
            `/v1/social/challenges/${encodeURIComponent(challengeId)}/contact-invitations`,
            {
              body: contact,
              idempotencyKey,
              method: 'POST',
            },
          ),
      ),
    inspectContactInvitation: (token) =>
      api.request<ChallengeContactInvitationPreview, { token: string }>(
        '/v1/social/challenge-contact-invitations/inspect',
        {
          body: { token },
          method: 'POST',
        },
      ),
    joinRegionalChallenge: (challengeId) =>
      mutate(`join-regional-challenge:${challengeId}`, (idempotencyKey) =>
        api.request<ChallengeInvitationResponse>(
          `/v1/social/challenges/${encodeURIComponent(challengeId)}/join`,
          { idempotencyKey, method: 'POST' },
        ),
      ),
    listBlocks: () =>
      api.request<readonly BlockedMember[]>('/v1/social/blocks'),
    listChallenges: () =>
      api.request<readonly SocialChallenge[]>('/v1/social/challenges'),
    listFriendRequests: () =>
      api.request<readonly FriendRequest[]>('/v1/social/friend-requests'),
    listFriends: () => api.request<readonly Friend[]>('/v1/social/friends'),
    respondToChallengeInvitation: (challengeId, decision) =>
      mutate(
        `challenge-decision:${challengeId}:${decision}`,
        (idempotencyKey) =>
          api.request<
            ChallengeInvitationResponse,
            { decision: FriendRequestDecision }
          >(
            `/v1/social/challenges/${encodeURIComponent(challengeId)}/invitations/me`,
            {
              body: { decision },
              idempotencyKey,
              method: 'PATCH',
            },
          ),
      ),
    redeemContactInvitation: (token, destination) =>
      mutate(
        `redeem-contact-invite:${mutationFingerprint(token)}`,
        (idempotencyKey) =>
          api.request<
            ChallengeInvitationResponse,
            { destination?: string; token: string }
          >('/v1/social/challenge-contact-invitations/redeem', {
            body: { ...(destination ? { destination } : {}), token },
            idempotencyKey,
            method: 'POST',
          }),
      ),
    removeFriend: (friendUserId) =>
      mutate(`remove-friend:${friendUserId}`, (idempotencyKey) =>
        api.request<SocialRelationshipAction>(
          `/v1/social/friends/${encodeURIComponent(friendUserId)}`,
          { idempotencyKey, method: 'DELETE' },
        ),
      ),
    respondToFriendRequest: (requestId, decision) =>
      mutate(
        `friend-request-decision:${requestId}:${decision}`,
        (idempotencyKey) =>
          api.request<
            FriendRequestDecisionResponse,
            { decision: FriendRequestDecision }
          >(`/v1/social/friend-requests/${encodeURIComponent(requestId)}`, {
            body: { decision },
            idempotencyKey,
            method: 'PATCH',
          }),
      ),
    searchUsers: (screenName) =>
      api.request<readonly SocialUserSearchResult[]>(
        `/v1/social/users?screenName=${encodeURIComponent(screenName)}`,
      ),
    sendFriendRequest: (recipientUserId) =>
      mutate(`send-friend-request:${recipientUserId}`, (idempotencyKey) =>
        api.request<FriendRequest, { recipientUserId: string }>(
          '/v1/social/friend-requests',
          { body: { recipientUserId }, idempotencyKey, method: 'POST' },
        ),
      ),
    updateScreenName: (screenName) =>
      Promise.all([
        api.request<
          MeResponse,
          {
            publicIdentityMode: 'alias';
            publicName: string;
            screenName: string;
          }
        >('/v1/me', {
          body: {
            publicIdentityMode: 'alias',
            publicName: screenName,
            screenName,
          },
          method: 'PATCH',
        }),
        api.request<unknown>('/v1/streaks/me'),
      ]).then(([profile, streaks]) => {
        const parsed = parseStreakSummary(streaks);
        if (!parsed) {
          throw new Error('The streak projection is unavailable.');
        }
        return toSocialProfile(profile, parsed);
      }),
    unblockMember: (blockedUserId) =>
      mutate(`unblock:${blockedUserId}`, (idempotencyKey) =>
        api.request<SocialRelationshipAction>(
          `/v1/social/blocks/${encodeURIComponent(blockedUserId)}`,
          { idempotencyKey, method: 'DELETE' },
        ),
      ),
  };
}

function createUnavailableSocialRepository(): SocialRepository {
  const unavailable = () =>
    Promise.reject(new Error('The social service is not configured.'));

  return {
    blockMember: unavailable,
    cancelFriendRequest: unavailable,
    checkInToChallenge: unavailable,
    createChallenge: unavailable,
    discoverRegionalChallenges: unavailable,
    getMyProfile: unavailable,
    inviteFriendToChallenge: unavailable,
    inviteContactToChallenge: unavailable,
    inspectContactInvitation: unavailable,
    joinRegionalChallenge: unavailable,
    listBlocks: unavailable,
    listChallenges: unavailable,
    listFriendRequests: unavailable,
    listFriends: unavailable,
    respondToChallengeInvitation: unavailable,
    redeemContactInvitation: unavailable,
    removeFriend: unavailable,
    respondToFriendRequest: unavailable,
    searchUsers: unavailable,
    sendFriendRequest: unavailable,
    unblockMember: unavailable,
    updateScreenName: unavailable,
  };
}

function requireApi(api: ApiClient | null) {
  if (!api) {
    throw new Error(
      'The social API repository requires a configured API client.',
    );
  }
  return api;
}

function toSocialProfile(
  profile: MeResponse,
  streaks: StreakSummary,
): SocialProfile {
  return {
    screenName: profile.screenName,
    streaks: streaks.streaks,
    userId: profile.id,
  };
}

let idempotencySequence = 0;

function createIdempotencyKey() {
  idempotencySequence = (idempotencySequence + 1) % Number.MAX_SAFE_INTEGER;
  return [
    'social',
    Date.now().toString(36),
    idempotencySequence.toString(36),
    Math.random().toString(36).slice(2, 13),
  ].join('-');
}

function mutationFingerprint(value: string) {
  let hash = 2_166_136_261;
  for (const character of value.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}
