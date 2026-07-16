import type { SocialRepository } from '@/data/socialRepository';
import type {
  CreateSocialChallengeInput,
  Friend,
  FriendRequest,
  SocialChallenge,
  SocialChallengeMember,
  SocialChallengeProgress,
  SocialProfile,
  SocialRelationship,
  SocialUser,
  SocialUserSearchResult
} from '@/domain/social';

const SELF_ID = '10000000-0000-4000-8000-000000000001';
const KIRA_ID = '10000000-0000-4000-8000-000000000002';
const NOVA_ID = '10000000-0000-4000-8000-000000000003';
const ZEN_ID = '10000000-0000-4000-8000-000000000004';
const MIKE_ID = '10000000-0000-4000-8000-000000000005';

const previewUsers: readonly SocialUser[] = [
  { screenName: 'GHOST_RUNNER', streaks: { daily: 6, monthly: 2, weekly: 4, yearly: 1 }, userId: SELF_ID },
  { screenName: 'KIRA_PULSE', streaks: { daily: 9, monthly: 3, weekly: 6, yearly: 1 }, userId: KIRA_ID },
  { screenName: 'NOVA_LIFT', streaks: { daily: 4, monthly: 1, weekly: 3, yearly: 0 }, userId: NOVA_ID },
  { screenName: 'ZEN_STRENGTH', streaks: { daily: 2, monthly: 0, weekly: 1, yearly: 0 }, userId: ZEN_ID },
  { screenName: 'MOTION_MIKE', streaks: { daily: 7, monthly: 2, weekly: 5, yearly: 1 }, userId: MIKE_ID }
];

export function createDemoSocialRepository(): SocialRepository {
  let self: SocialProfile = { ...previewUsers[0] };
  let friends: Friend[] = [
    {
      friendsSince: '2026-06-24T18:00:00.000Z',
      screenName: 'KIRA_PULSE',
      streaks: previewUsers[1].streaks,
      userId: KIRA_ID
    }
  ];
  let requests: FriendRequest[] = [
    {
      createdAt: '2026-07-14T20:15:00.000Z',
      direction: 'incoming',
      id: '20000000-0000-4000-8000-000000000001',
      user: { ...previewUsers[2] }
    },
    {
      createdAt: '2026-07-15T02:30:00.000Z',
      direction: 'outgoing',
      id: '20000000-0000-4000-8000-000000000002',
      user: { ...previewUsers[3] }
    }
  ];
  let challenges: SocialChallenge[] = initialMyChallenges(self);
  let regionalChallenges: SocialChallenge[] = initialRegionalChallenges();
  let sequence = 10;

  return {
    checkInToChallenge: async (challengeId) => {
      const challenge = challenges.find(({ id }) => id === challengeId);
      if (!challenge || challenge.myStatus !== 'accepted') {
        throw new Error('Join or accept this challenge before checking in.');
      }
      const now = new Date();
      const eligibleDate = formatDateKeyInTimezone(
        now,
        challenge.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      if (eligibleDate < challenge.startDate || eligibleDate > challenge.endDate) {
        throw new Error('Check-ins are only available during the challenge window.');
      }
      if (
        challenge.scheduledDays.length > 0 &&
        !challenge.scheduledDays.includes(weekdayInTimezone(
          now,
          challenge.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
        ))
      ) {
        throw new Error('This challenge is not scheduled for today.');
      }
      if (challenge.activity === 'gym') {
        throw new Error('Gym challenge progress updates after a verified workout.');
      }
      const progress = incrementProgress(challenge.myProgress);
      challenges = challenges.map((candidate) => candidate.id === challengeId
        ? updateMyProgress(candidate, self.userId, progress)
        : candidate
      );
      regionalChallenges = regionalChallenges.map((candidate) => candidate.id === challengeId
        ? updateMyProgress(candidate, self.userId, progress)
        : candidate
      );
      return {
        challengeId,
        checkInId: previewId(4, sequence++),
        eligibleDate,
        source: 'manual'
      };
    },
    createChallenge: async (input) => {
      const now = new Date().toISOString();
      const targetTotal = challengeTargetTotal(input);
      const invitedMembers = input.invitedFriendUserIds.map((userId) => {
        const friend = friends.find((candidate) => candidate.userId === userId);
        if (!friend) {
          throw new Error('Only accepted friends can be invited to a challenge.');
        }
        return member(friend, 'member', 'pending', targetTotal, 0);
      });
      const challenge: SocialChallenge = {
        ...input,
        createdAt: now,
        description: input.description ?? null,
        id: previewId(3, sequence++),
        locationName: input.locationName ?? null,
        members: [member(self, 'owner', 'accepted', targetTotal, 0), ...invitedMembers],
        myProgress: progress(targetTotal, 0),
        myRole: 'owner',
        myStatus: 'accepted',
        ownerScreenName: self.screenName,
        ownerStreaks: self.streaks,
        ownerUserId: self.userId,
        participantCount: 1,
        participantLimit: input.participantLimit ?? null,
        regionCode: input.regionCode ?? null,
        regionName: input.regionCode === 'TORONTO' ? 'Toronto' : input.regionCode ?? null,
        scheduledTime: input.scheduledTime ?? null,
        timezone: input.challengeType === 'regional' ? 'America/Toronto' : null
      };
      challenges = [challenge, ...challenges];
      if (challenge.challengeType === 'regional') {
        regionalChallenges = [challenge, ...regionalChallenges];
      }
      return cloneChallenge(challenge);
    },
    discoverRegionalChallenges: async (regionCode) => regionalChallenges
      .filter((challenge) => challenge.regionCode === regionCode.toUpperCase())
      .map(cloneChallenge),
    getMyProfile: async () => ({ ...self }),
    inviteFriendToChallenge: async (challengeId, friendUserId) => {
      const friend = friends.find(({ userId }) => userId === friendUserId);
      if (!friend) {
        throw new Error('Only accepted friends can be invited to a challenge.');
      }
      const challenge = challenges.find(({ id }) => id === challengeId);
      if (!challenge || challenge.myRole !== 'owner') {
        throw new Error('Only the challenge creator can invite friends.');
      }
      const existing = challenge.members.find(({ userId }) => userId === friendUserId);
      if (existing?.status === 'accepted') {
        throw new Error('That friend is already in this challenge.');
      }

      const invitation = member(
        friend,
        'member',
        'pending',
        challenge.myProgress.targetTotal,
        0
      );
      challenges = challenges.map((candidate) => candidate.id === challengeId
        ? {
            ...candidate,
            members: existing
              ? candidate.members.map((candidateMember) =>
                  candidateMember.userId === friendUserId ? invitation : candidateMember
                )
              : [...candidate.members, invitation]
          }
        : candidate
      );
      return { challengeId, status: 'pending' as const, userId: friendUserId };
    },
    inviteContactToChallenge: async (challengeId, contact) => ({
      challengeId,
      channel: contact.channel,
      destinationHint: contact.channel === 'email'
        ? `${contact.destination.slice(0, 1)}***@${contact.destination.split('@')[1] ?? 'email'}`
        : `•••${contact.destination.replace(/\D/g, '').slice(-4)}`,
      expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1_000).toISOString(),
      id: previewId(9, sequence++),
      joinUrl: `https://gogymgo.com/join?challengeInvite=preview-${sequence}`
    }),
    joinRegionalChallenge: async (challengeId) => {
      const challenge = regionalChallenges.find(({ id }) => id === challengeId);
      if (!challenge || challenge.challengeType !== 'regional') {
        throw new Error('That regional challenge is not available.');
      }
      if (
        challenge.participantLimit !== null &&
        challenge.participantCount >= challenge.participantLimit
      ) {
        throw new Error('That challenge has reached its participant limit.');
      }
      const joined = {
        ...challenge,
        members: [
          ...challenge.members,
          member(self, 'member', 'accepted', challenge.myProgress.targetTotal, 0)
        ],
        myRole: 'member' as const,
        myStatus: 'accepted' as const,
        participantCount: challenge.participantCount + 1
      };
      regionalChallenges = regionalChallenges.map((candidate) =>
        candidate.id === challengeId ? joined : candidate
      );
      challenges = [joined, ...challenges.filter(({ id }) => id !== challengeId)];
      return { challengeId, status: 'accepted' as const, userId: self.userId };
    },
    listChallenges: async () => challenges.map(cloneChallenge),
    listFriendRequests: async () => requests.map(cloneRequest),
    listFriends: async () => friends.map((friend) => ({ ...friend })),
    respondToChallengeInvitation: async (challengeId, decision) => {
      const challenge = challenges.find(({ id }) => id === challengeId);
      if (!challenge || challenge.myRole !== 'member' || challenge.myStatus !== 'pending') {
        throw new Error('That challenge invitation is no longer pending.');
      }
      challenges = challenges.flatMap((candidate) => {
        if (candidate.id !== challengeId) return [candidate];
        if (decision === 'declined') return [];
        return [{
          ...candidate,
          members: candidate.members.map((candidateMember) =>
            candidateMember.userId === self.userId
              ? { ...candidateMember, status: 'accepted' as const }
              : candidateMember
          ),
          myStatus: 'accepted' as const,
          participantCount: candidate.participantCount + 1
        }];
      });
      return { challengeId, status: decision, userId: self.userId };
    },
    redeemContactInvitation: async () => ({
      challengeId: previewId(8, sequence++),
      status: 'accepted' as const,
      userId: self.userId
    }),
    respondToFriendRequest: async (requestId, decision) => {
      const request = requests.find(
        (candidate) => candidate.id === requestId && candidate.direction === 'incoming'
      );
      if (!request) {
        throw new Error('That incoming friend request is no longer pending.');
      }
      requests = requests.filter(({ id }) => id !== requestId);
      if (decision === 'accepted') {
        friends = [{ ...request.user, friendsSince: new Date().toISOString() }, ...friends];
      }
      return { requestId, status: decision };
    },
    searchUsers: async (screenName) => {
      const query = screenName.toLowerCase();
      return previewUsers
        .filter((user) => user.userId !== self.userId)
        .filter((user) => user.screenName.toLowerCase().includes(query))
        .map<SocialUserSearchResult>((user) => ({
          ...user,
          relationship: relationshipFor(user.userId, friends, requests)
        }))
        .map((result) => ({ ...result }));
    },
    sendFriendRequest: async (recipientUserId) => {
      if (friends.some(({ userId }) => userId === recipientUserId)) {
        throw new Error('You are already friends with that user.');
      }
      const pending = requests.find(({ user }) => user.userId === recipientUserId);
      if (pending?.direction === 'incoming') {
        throw new Error('That user has already sent you a friend request.');
      }
      if (pending) return cloneRequest(pending);
      const user = previewUsers.find(({ userId }) => userId === recipientUserId);
      if (!user || user.userId === self.userId) {
        throw new Error('That user is not available.');
      }
      const request: FriendRequest = {
        createdAt: new Date().toISOString(),
        direction: 'outgoing',
        id: previewId(2, sequence++),
        user: { ...user }
      };
      requests = [request, ...requests];
      return cloneRequest(request);
    },
    updateScreenName: async (screenName) => {
      const duplicate = previewUsers.some(
        (user) => user.userId !== self.userId &&
          user.screenName.toLowerCase() === screenName.toLowerCase()
      );
      if (duplicate) throw new Error('That alias is already in use.');
      self = { ...self, screenName };
      challenges = challenges.map((challenge) => updateScreenName(challenge, self));
      regionalChallenges = regionalChallenges.map((challenge) =>
        updateScreenName(challenge, self)
      );
      return { ...self };
    }
  };
}

function initialMyChallenges(self: SocialProfile): SocialChallenge[] {
  return [
    challengeFixture({
      activity: 'gym',
      activityLabel: 'Gym visits',
      challengeType: 'friend',
      completedCount: 9,
      id: '30000000-0000-4000-8000-000000000001',
      members: [
        member(self, 'owner', 'accepted', 20, 9),
        member(previewUsers[1], 'member', 'accepted', 20, 8)
      ],
      myRole: 'owner',
      myStatus: 'accepted',
      name: 'JULY 4X GYM CREW',
      owner: self,
      targetCount: 4,
      targetPeriod: 'weekly',
      targetTotal: 20
    }),
    challengeFixture({
      activity: 'running',
      activityLabel: 'Outdoor runs',
      challengeType: 'friend',
      completedCount: 0,
      id: '30000000-0000-4000-8000-000000000002',
      members: [
        member(previewUsers[1], 'owner', 'accepted', 10, 5),
        member(self, 'member', 'pending', 10, 0)
      ],
      myRole: 'member',
      myStatus: 'pending',
      name: 'WEEKEND RUN CLUB',
      owner: previewUsers[1],
      targetCount: 2,
      targetPeriod: 'weekly',
      targetTotal: 10
    }),
    challengeFixture({
      activity: 'hiking',
      activityLabel: 'Group hikes',
      challengeType: 'regional',
      completedCount: 2,
      id: '30000000-0000-4000-8000-000000000003',
      locationName: 'High Park north gate',
      members: [
        member(previewUsers[4], 'owner', 'accepted', 4, 3),
        member(self, 'member', 'accepted', 4, 2)
      ],
      myRole: 'member',
      myStatus: 'accepted',
      name: 'SATURDAY CITY HIKES',
      owner: previewUsers[4],
      participantCount: 18,
      participantLimit: 30,
      scheduledDays: [6],
      scheduledTime: '09:00',
      targetCount: 4,
      targetPeriod: 'monthly',
      targetTotal: 4
    })
  ];
}

function initialRegionalChallenges(): SocialChallenge[] {
  return [
    challengeFixture({
      activity: 'running',
      activityLabel: '5K group runs',
      challengeType: 'regional',
      completedCount: 0,
      id: '30000000-0000-4000-8000-000000000004',
      locationName: 'Waterfront Trail - Music Garden',
      members: [member(previewUsers[2], 'owner', 'accepted', 8, 4)],
      myRole: null,
      myStatus: 'not_joined',
      name: 'WATERFRONT RUN SERIES',
      owner: previewUsers[2],
      participantCount: 24,
      participantLimit: 40,
      scheduledDays: [2, 4],
      scheduledTime: '18:30',
      targetCount: 8,
      targetPeriod: 'monthly',
      targetTotal: 8
    }),
    challengeFixture({
      activity: 'cycling',
      activityLabel: 'Social cycling',
      challengeType: 'regional',
      completedCount: 0,
      id: '30000000-0000-4000-8000-000000000005',
      locationName: 'Tommy Thompson Park entrance',
      members: [member(previewUsers[3], 'owner', 'accepted', 4, 2)],
      myRole: null,
      myStatus: 'not_joined',
      name: 'SUNSET CYCLING CLUB',
      owner: previewUsers[3],
      participantCount: 11,
      participantLimit: 20,
      scheduledDays: [0],
      scheduledTime: '17:30',
      targetCount: 4,
      targetPeriod: 'monthly',
      targetTotal: 4
    })
  ];
}

type ChallengeFixtureInput = {
  activity: SocialChallenge['activity'];
  activityLabel: string;
  challengeType: SocialChallenge['challengeType'];
  completedCount: number;
  id: string;
  locationName?: string;
  members: readonly SocialChallengeMember[];
  myRole: SocialChallenge['myRole'];
  myStatus: SocialChallenge['myStatus'];
  name: string;
  owner: SocialUser;
  participantCount?: number;
  participantLimit?: number;
  scheduledDays?: readonly number[];
  scheduledTime?: string;
  targetCount: number;
  targetPeriod: SocialChallenge['targetPeriod'];
  targetTotal: number;
};

function challengeFixture(input: ChallengeFixtureInput): SocialChallenge {
  return {
    activity: input.activity,
    activityLabel: input.activityLabel,
    challengeType: input.challengeType,
    createdAt: '2026-07-12T19:00:00.000Z',
    description: null,
    endDate: '2026-07-31',
    id: input.id,
    locationName: input.locationName ?? null,
    members: input.members,
    myProgress: progress(input.targetTotal, input.completedCount),
    myRole: input.myRole,
    myStatus: input.myStatus,
    name: input.name,
    ownerScreenName: input.owner.screenName,
    ownerStreaks: input.owner.streaks,
    ownerUserId: input.owner.userId,
    participantCount: input.participantCount ?? input.members.filter(
      ({ status }) => status === 'accepted'
    ).length,
    participantLimit: input.participantLimit ?? null,
    regionCode: input.challengeType === 'regional' ? 'TORONTO' : null,
    regionName: input.challengeType === 'regional' ? 'Toronto' : null,
    scheduledDays: input.scheduledDays ?? [],
    scheduledTime: input.scheduledTime ?? null,
    startDate: '2026-07-01',
    targetCount: input.targetCount,
    targetPeriod: input.targetPeriod,
    timezone: input.challengeType === 'regional' ? 'America/Toronto' : null
  };
}

function relationshipFor(
  userId: string,
  friends: readonly Friend[],
  requests: readonly FriendRequest[]
): SocialRelationship {
  if (friends.some((friend) => friend.userId === userId)) return 'friend';
  const request = requests.find((candidate) => candidate.user.userId === userId);
  if (request?.direction === 'incoming') return 'incoming_request';
  if (request?.direction === 'outgoing') return 'outgoing_request';
  return 'none';
}

function member(
  user: SocialUser,
  role: SocialChallengeMember['role'],
  status: SocialChallengeMember['status'],
  targetTotal: number,
  completedCount: number
): SocialChallengeMember {
  return { ...user, progress: progress(targetTotal, completedCount), role, status };
}

function progress(targetTotal: number, completedCount: number): SocialChallengeProgress {
  return {
    completedCount,
    completionPercent: Math.min(100, Math.round((completedCount / targetTotal) * 100)),
    targetTotal
  };
}

function incrementProgress(current: SocialChallengeProgress) {
  return progress(current.targetTotal, Math.min(current.targetTotal, current.completedCount + 1));
}

function updateMyProgress(
  challenge: SocialChallenge,
  userId: string,
  nextProgress: SocialChallengeProgress
): SocialChallenge {
  return {
    ...challenge,
    members: challenge.members.map((candidate) => candidate.userId === userId
      ? { ...candidate, progress: nextProgress }
      : candidate
    ),
    myProgress: nextProgress
  };
}

function updateScreenName(challenge: SocialChallenge, self: SocialProfile): SocialChallenge {
  return {
    ...challenge,
    members: challenge.members.map((challengeMember) =>
      challengeMember.userId === self.userId
        ? { ...challengeMember, screenName: self.screenName }
        : challengeMember
    ),
    ownerScreenName: challenge.ownerUserId === self.userId
      ? self.screenName
      : challenge.ownerScreenName,
    ownerStreaks: challenge.ownerUserId === self.userId
      ? self.streaks
      : challenge.ownerStreaks
  };
}

function challengeTargetTotal(input: CreateSocialChallengeInput) {
  if (input.targetPeriod === 'monthly') return input.targetCount;
  const start = new Date(`${input.startDate}T00:00:00.000Z`);
  const end = new Date(`${input.endDate}T00:00:00.000Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return input.targetCount * Math.ceil(days / 7);
}

function cloneRequest(request: FriendRequest): FriendRequest {
  return { ...request, user: { ...request.user } };
}

function cloneChallenge(challenge: SocialChallenge): SocialChallenge {
  return {
    ...challenge,
    members: challenge.members.map((challengeMember) => ({
      ...challengeMember,
      progress: { ...challengeMember.progress }
    })),
    myProgress: { ...challenge.myProgress },
    scheduledDays: [...challenge.scheduledDays]
  };
}

function formatDateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function weekdayInTimezone(date: Date, timezone: string) {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  }).format(date).toUpperCase();
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(label);
}

function previewId(prefix: number, sequence: number) {
  return `${prefix}0000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
}
