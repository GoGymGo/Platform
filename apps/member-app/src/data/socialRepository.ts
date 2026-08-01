import type { AppDataMode } from '@/data/appData';
import type {
  ChallengeCheckIn,
  ChallengeContactInvitation,
  ChallengeInviteContact,
  CreateSocialChallengeInput,
  Friend,
  FriendRequest,
  FriendRequestDecision,
  SocialChallenge,
  SocialProfile,
  SocialUserSearchResult
} from '@/domain/social';
import type { StreakSummary } from '@/domain/streaks';
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
  checkInToChallenge: (challengeId: string) => Promise<ChallengeCheckIn>;
  createChallenge: (input: CreateSocialChallengeInput) => Promise<SocialChallenge>;
  discoverRegionalChallenges: (
    regionCode: string
  ) => Promise<readonly SocialChallenge[]>;
  getMyProfile: () => Promise<SocialProfile | null>;
  inviteFriendToChallenge: (
    challengeId: string,
    friendUserId: string
  ) => Promise<ChallengeInvitationResponse>;
  inviteContactToChallenge: (
    challengeId: string,
    contact: ChallengeInviteContact
  ) => Promise<ChallengeContactInvitation>;
  joinRegionalChallenge: (challengeId: string) => Promise<ChallengeInvitationResponse>;
  listChallenges: () => Promise<readonly SocialChallenge[]>;
  listFriendRequests: () => Promise<readonly FriendRequest[]>;
  listFriends: () => Promise<readonly Friend[]>;
  respondToChallengeInvitation: (
    challengeId: string,
    decision: FriendRequestDecision
  ) => Promise<ChallengeInvitationResponse>;
  redeemContactInvitation: (token: string) => Promise<ChallengeInvitationResponse>;
  respondToFriendRequest: (
    requestId: string,
    decision: FriendRequestDecision
  ) => Promise<FriendRequestDecisionResponse>;
  searchUsers: (screenName: string) => Promise<readonly SocialUserSearchResult[]>;
  sendFriendRequest: (recipientUserId: string) => Promise<FriendRequest>;
  updateScreenName: (screenName: string) => Promise<SocialProfile>;
};

export function createSocialRepository(
  mode: AppDataMode,
  api: ApiClient | null
): SocialRepository {
  if (mode === 'api') {
    return createApiSocialRepository(requireApi(api));
  }

  return createUnavailableSocialRepository();
}

function createApiSocialRepository(api: ApiClient): SocialRepository {
  return {
    checkInToChallenge: (challengeId) => api.request<ChallengeCheckIn>(
      `/v1/social/challenges/${encodeURIComponent(challengeId)}/check-ins`,
      {
        idempotencyKey: createIdempotencyKey(),
        method: 'POST'
      }
    ),
    createChallenge: (input) => api.request<
      SocialChallenge,
      CreateSocialChallengeInput
    >(
      '/v1/social/challenges',
      {
        body: input,
        idempotencyKey: createIdempotencyKey(),
        method: 'POST'
      }
    ),
    discoverRegionalChallenges: (regionCode) => api.request<readonly SocialChallenge[]>(
      `/v1/social/challenges/discover?regionCode=${encodeURIComponent(regionCode)}`
    ),
    getMyProfile: () => Promise.all([
      api.request<MeResponse>('/v1/me'),
      api.request<StreakSummary>('/v1/streaks/me')
    ]).then(([profile, streaks]) => toSocialProfile(profile, streaks)),
    inviteFriendToChallenge: (challengeId, friendUserId) =>
      api.request<ChallengeInvitationResponse, { friendUserId: string }>(
        `/v1/social/challenges/${encodeURIComponent(challengeId)}/invitations`,
        {
          body: { friendUserId },
          idempotencyKey: createIdempotencyKey(),
          method: 'POST'
        }
      ),
    inviteContactToChallenge: (challengeId, contact) =>
      api.request<ChallengeContactInvitation, ChallengeInviteContact>(
        `/v1/social/challenges/${encodeURIComponent(challengeId)}/contact-invitations`,
        {
          body: contact,
          idempotencyKey: createIdempotencyKey(),
          method: 'POST'
        }
      ),
    joinRegionalChallenge: (challengeId) => api.request<ChallengeInvitationResponse>(
      `/v1/social/challenges/${encodeURIComponent(challengeId)}/join`,
      {
        idempotencyKey: createIdempotencyKey(),
        method: 'POST'
      }
    ),
    listChallenges: () => api.request<readonly SocialChallenge[]>('/v1/social/challenges'),
    listFriendRequests: () => api.request<readonly FriendRequest[]>('/v1/social/friend-requests'),
    listFriends: () => api.request<readonly Friend[]>('/v1/social/friends'),
    respondToChallengeInvitation: (challengeId, decision) =>
      api.request<ChallengeInvitationResponse, { decision: FriendRequestDecision }>(
        `/v1/social/challenges/${encodeURIComponent(challengeId)}/invitations/me`,
        {
          body: { decision },
          idempotencyKey: createIdempotencyKey(),
          method: 'PATCH'
        }
      ),
    redeemContactInvitation: (token) =>
      api.request<ChallengeInvitationResponse, { token: string }>(
        '/v1/social/challenge-contact-invitations/redeem',
        {
          body: { token },
          idempotencyKey: createIdempotencyKey(),
          method: 'POST'
        }
      ),
    respondToFriendRequest: (requestId, decision) =>
      api.request<FriendRequestDecisionResponse, { decision: FriendRequestDecision }>(
        `/v1/social/friend-requests/${encodeURIComponent(requestId)}`,
        {
          body: { decision },
          idempotencyKey: createIdempotencyKey(),
          method: 'PATCH'
        }
      ),
    searchUsers: (screenName) => api.request<readonly SocialUserSearchResult[]>(
      `/v1/social/users?screenName=${encodeURIComponent(screenName)}`
    ),
    sendFriendRequest: (recipientUserId) => api.request<
      FriendRequest,
      { recipientUserId: string }
    >('/v1/social/friend-requests', {
      body: { recipientUserId },
      idempotencyKey: createIdempotencyKey(),
      method: 'POST'
    }),
    updateScreenName: (screenName) => Promise.all([
      api.request<MeResponse, {
        publicIdentityMode: 'alias';
        publicName: string;
        screenName: string;
      }>(
        '/v1/me',
        {
          body: {
            publicIdentityMode: 'alias',
            publicName: screenName,
            screenName
          },
          method: 'PATCH'
        }
      ),
      api.request<StreakSummary>('/v1/streaks/me')
    ]).then(([profile, streaks]) => toSocialProfile(profile, streaks))
  };
}

function createUnavailableSocialRepository(): SocialRepository {
  const unavailable = () => Promise.reject(new Error('The social service is not configured.'));

  return {
    checkInToChallenge: unavailable,
    createChallenge: unavailable,
    discoverRegionalChallenges: () => Promise.resolve([]),
    getMyProfile: () => Promise.resolve(null),
    inviteFriendToChallenge: unavailable,
    inviteContactToChallenge: unavailable,
    joinRegionalChallenge: unavailable,
    listChallenges: () => Promise.resolve([]),
    listFriendRequests: () => Promise.resolve([]),
    listFriends: () => Promise.resolve([]),
    respondToChallengeInvitation: unavailable,
    redeemContactInvitation: unavailable,
    respondToFriendRequest: unavailable,
    searchUsers: () => Promise.resolve([]),
    sendFriendRequest: unavailable,
    updateScreenName: unavailable
  };
}

function requireApi(api: ApiClient | null) {
  if (!api) {
    throw new Error('The social API repository requires a configured API client.');
  }
  return api;
}

function toSocialProfile(
  profile: MeResponse,
  streaks: StreakSummary
): SocialProfile {
  return {
    screenName: profile.screenName,
    streaks: streaks.streaks,
    userId: profile.id
  };
}

let idempotencySequence = 0;

function createIdempotencyKey() {
  idempotencySequence = (idempotencySequence + 1) % Number.MAX_SAFE_INTEGER;
  return [
    'social',
    Date.now().toString(36),
    idempotencySequence.toString(36),
    Math.random().toString(36).slice(2, 13)
  ].join('-');
}
