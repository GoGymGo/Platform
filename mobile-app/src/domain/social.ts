import type { StreakCounts } from '@/domain/streaks';
export type SocialRelationship =
  | 'none'
  | 'friend'
  | 'incoming_request'
  | 'outgoing_request';

export type SocialUser = {
  screenName: string;
  streaks: StreakCounts;
  userId: string;
};

export type SocialProfile = SocialUser;

export type SocialUserSearchResult = SocialUser & {
  relationship: SocialRelationship;
};

export type Friend = SocialUser & {
  friendsSince: string;
};

export type FriendRequest = {
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  id: string;
  user: SocialUser;
};

export type FriendRequestDecision = 'accepted' | 'declined';

export const socialChallengeActivities = [
  'gym',
  'running',
  'walking',
  'cycling',
  'hiking',
  'fitness_class',
  'other'
] as const;

export type SocialChallengeActivity = typeof socialChallengeActivities[number];
export type SocialChallengeType = 'friend' | 'regional';
export type SocialChallengeTargetPeriod = 'monthly' | 'weekly';

export type SocialChallengeProgress = {
  completedCount: number;
  completionPercent: number;
  targetTotal: number;
};

export type SocialChallengeMember = SocialUser & {
  progress: SocialChallengeProgress;
  role: 'member' | 'owner';
  status: 'accepted' | 'declined' | 'pending';
};

export type SocialChallenge = {
  activity: SocialChallengeActivity;
  activityLabel: string;
  challengeType: SocialChallengeType;
  createdAt: string;
  description: string | null;
  endDate: string;
  id: string;
  locationName: string | null;
  members: readonly SocialChallengeMember[];
  myProgress: SocialChallengeProgress;
  myRole: 'member' | 'owner' | null;
  myStatus: 'accepted' | 'not_joined' | 'pending';
  name: string;
  ownerScreenName: string;
  ownerStreaks: StreakCounts;
  ownerUserId: string;
  participantCount: number;
  participantLimit: number | null;
  regionCode: string | null;
  regionName: string | null;
  scheduledDays: readonly number[];
  scheduledTime: string | null;
  startDate: string;
  targetCount: number;
  targetPeriod: SocialChallengeTargetPeriod;
  timezone: string | null;
};

export type CreateSocialChallengeInput = {
  activity: SocialChallengeActivity;
  activityLabel: string;
  challengeType: SocialChallengeType;
  description?: string;
  endDate: string;
  invitedFriendUserIds: readonly string[];
  locationName?: string;
  name: string;
  participantLimit?: number;
  regionCode?: string;
  scheduledDays: readonly number[];
  scheduledTime?: string;
  startDate: string;
  targetCount: number;
  targetPeriod: SocialChallengeTargetPeriod;
};

export type ChallengeCheckIn = {
  challengeId: string;
  checkInId: string;
  eligibleDate: string;
  source: 'manual' | 'verified_workout';
};

export type ChallengeContactInvitation = {
  challengeId: string;
  channel: 'email' | 'phone';
  destinationHint: string;
  expiresAt: string;
  id: string;
  joinUrl: string;
};

export type ChallengeInviteContact = {
  channel: 'email' | 'phone';
  destination: string;
};

export const challengeActivityLabels: Record<SocialChallengeActivity, string> = {
  cycling: 'Cycling',
  fitness_class: 'Fitness class',
  gym: 'Gym visits',
  hiking: 'Hiking',
  other: 'Other activity',
  running: 'Running',
  walking: 'Walking'
};

export function normalizeScreenName(value: string) {
  return value.trim();
}

export function validateScreenName(value: string): string | null {
  const normalized = normalizeScreenName(value);

  if (normalized.length < 3 || normalized.length > 24) {
    return 'Use 3-24 characters.';
  }
  if (!/^[A-Za-z0-9_]+$/.test(normalized)) {
    return 'Use letters, numbers, and underscores only.';
  }

  return null;
}

export function normalizeChallengeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateChallengeName(value: string): string | null {
  const normalized = normalizeChallengeName(value);

  if (!normalized) {
    return 'Enter a challenge name.';
  }
  if (normalized.length > 80) {
    return 'Keep the challenge name to 80 characters.';
  }

  return null;
}

export function normalizeChallengeInput(
  input: CreateSocialChallengeInput
): CreateSocialChallengeInput {
  return {
    ...input,
    activityLabel: input.activityLabel.trim().replace(/\s+/g, ' '),
    description: input.description?.trim().replace(/\s+/g, ' ') || undefined,
    invitedFriendUserIds: [...new Set(input.invitedFriendUserIds)],
    locationName: input.locationName?.trim().replace(/\s+/g, ' ') || undefined,
    name: normalizeChallengeName(input.name),
    regionCode: input.regionCode?.trim().toLowerCase() || undefined,
    scheduledDays: [...new Set(input.scheduledDays)].sort((left, right) => left - right),
    scheduledTime: input.scheduledTime?.trim() || undefined
  };
}

export function validateChallengeInput(
  input: CreateSocialChallengeInput,
  externalInviteCount = 0
): string | null {
  const normalized = normalizeChallengeInput(input);
  const nameError = validateChallengeName(normalized.name);
  if (nameError) return nameError;
  if (normalized.activityLabel.length < 2 || normalized.activityLabel.length > 60) {
    return 'Describe the activity in 2-60 characters.';
  }
  if (!Number.isInteger(normalized.targetCount) || normalized.targetCount < 1 || normalized.targetCount > 31) {
    return 'Choose a target between 1 and 31.';
  }
  const windowDays = challengeWindowDays(normalized.startDate, normalized.endDate);
  if (windowDays < 1 || windowDays > 31) {
    return 'Choose a challenge window between 1 and 31 days.';
  }
  if (
    normalized.challengeType === 'friend' &&
    normalized.invitedFriendUserIds.length === 0 &&
    externalInviteCount === 0
  ) {
    return 'Choose a friend or enter an email address or phone number.';
  }
  if (normalized.challengeType === 'regional') {
    if (!normalized.regionCode) return 'Choose a supported region.';
    if (!normalized.locationName) return 'Enter a meeting location.';
    if (!normalized.scheduledTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized.scheduledTime)) {
      return 'Enter the local start time as HH:MM.';
    }
    if (normalized.scheduledDays.length === 0) return 'Choose at least one scheduled day.';
  }
  return null;
}

export function buildChallengeMonthWindow(now = new Date(), monthOffset = 0) {
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  return {
    endDate: formatLocalDateKey(end),
    label: new Intl.DateTimeFormat('en-CA', {
      month: 'long',
      year: 'numeric'
    }).format(start),
    startDate: formatLocalDateKey(start)
  };
}

function challengeWindowDays(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T00:00:00.000Z`);
  const end = new Date(`${endDateKey}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
