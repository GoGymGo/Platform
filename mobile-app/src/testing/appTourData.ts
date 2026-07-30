import type { AccountReadinessRepository } from '@/data/accountReadinessRepository';
import type { AccountSettingsRepository } from '@/data/accountSettingsRepository';
import type { AppDataSource } from '@/data/appData';
import type { SocialRepository } from '@/data/socialRepository';
import type { WorkoutSessionRepository } from '@/data/sessionRepository';
import type {
  CompetitionEnrollment,
  CurrentCompetition,
  CurrentLegalDocuments,
  LegalReceiptStatus,
  RegionVerification
} from '@/domain/accountReadiness';
import type { AvatarMedia, DevicePresenceConsent } from '@/domain/accountSettings';
import type { GoalCategory } from '@/domain/campaignEconomics';
import type {
  CompetitionMatch,
  CompetitionPeriodIndex,
  WeeklyChallengeRequest
} from '@/domain/competition';
import type {
  CreatorVideoSubmission,
  CreatorWorkoutPlan
} from '@/domain/creatorWorkouts';
import type { CategoryLeaderboard } from '@/domain/leaderboard';
import type { RewardAward } from '@/domain/rewards';
import type {
  AuthoritativeWorkoutSession,
  CompetitionProgress
} from '@/domain/session';
import type {
  CreateSocialChallengeInput,
  FriendRequest,
  SocialChallenge,
  SocialProfile
} from '@/domain/social';
import type { PersistedActiveWorkoutSession } from '@/domain/workoutProgress';
import type { AuthenticatedUser } from '@/state/auth';
import type { AppTourScenario } from '@/state/appTour';

const appTourCompetitionId = '10000000-0000-4000-8000-000000000001';
const appTourEnrollmentId = '10000000-0000-4000-8000-000000000002';
const appTourRegionPolicyId = '10000000-0000-4000-8000-000000000003';
const appTourRegionVerificationId = '10000000-0000-4000-8000-000000000004';
const appTourLegalBundleId = '10000000-0000-4000-8000-000000000005';
const appTourUserId = 'app-tour-player';
const fixedStreaks = {
  daily: 4,
  monthly: 2,
  weekly: 3,
  yearly: 1
} as const;

export const appTourUser: AuthenticatedUser = {
  displayName: 'App Tour Player',
  email: 'app-tour@gogymgo.local',
  emailVerified: true,
  photoUrl: null,
  providerIds: ['app-tour'],
  uid: appTourUserId
};

export function createAppTourDataSource(): AppDataSource {
  const awards: RewardAward[] = [
    {
      awardRank: 1,
      awardedAt: nowIso(),
      claimedAt: null,
      id: 'app-tour-award',
      imageUrl: null,
      rewardType: 'coupon',
      sponsorName: 'Tour Partner',
      status: 'awarded',
      title: 'Recovery Pack'
    }
  ];

  return {
    claimReward: async (awardId) => {
      const award = awards.find(({ id }) => id === awardId) ?? awards[0];
      const claimed = {
        ...award,
        claimedAt: nowIso(),
        claimUrl: null,
        couponCode: 'APP-TOUR',
        fulfillmentInstructions: 'Testing mode claim completed.',
        status: 'claimed' as const
      };
      awards.splice(0, awards.length, claimed);
      return claimed;
    },
    getCategoryLeaderboard: async (goal) => createLeaderboard(goal),
    getCompetitionMatches: async (monthKey, _weeklyGoal, region) =>
      createCompetitionMatches(monthKey, region),
    getCompetitionEnrollmentCount: async () => 128,
    getCreatorWorkouts: async () => [
      {
        creatorName: 'GoGymGo Coach',
        durationMinutes: 30,
        id: 'app-tour-workout',
        joined: true,
        name: 'Full Body Circuit',
        regionCodes: ['CA-ON-TORONTO'],
        reward: 'Completion badge',
        sponsorName: 'Tour Partner',
        thumbnailUrl: null,
        timing: 'ON DEMAND',
        videoUrl: 'https://example.invalid/app-tour-workout',
        workoutStyle: 'Strength + conditioning'
      }
    ],
    getCreatorWorkoutPlans: async () => [],
    getEligibleWeeklyChallengePartners: async () => [
      {
        alias: 'MOVE_MORE',
        goalDays: 4,
        requestStatus: 'available',
        streaks: fixedStreaks,
        userId: 'app-tour-friend'
      }
    ],
    getWeeklyChallengeRequests: async (
      _competitionMonthKey,
      goalDays,
      _region,
      periodIndex
    ) => [createWeeklyChallengeRequest(goalDays, periodIndex)],
    getMyRewardAwards: async () => awards,
    getMyStreaks: async () => ({
      asOfDate: todayKey(),
      streaks: fixedStreaks,
      timezone: 'America/Toronto'
    }),
    getRewardCatalog: async (region, monthKey = currentMonthKey()) => [
      {
        competitionId: appTourCompetitionId,
        competitionName: 'Monthly GoGymGo Competition',
        description: 'A testing-mode reward used only inside App Tour.',
        id: 'app-tour-reward',
        imageUrl: null,
        inventoryRemaining: 12,
        inventoryTotal: 20,
        monthKey,
        regionCode: 'CA-ON-TORONTO',
        regionName: region,
        rewardType: 'coupon',
        sponsorName: 'Tour Partner',
        termsUrl: null,
        title: 'Recovery Pack'
      }
    ],
    getRewardWinners: async () => [
      {
        alias: 'NORTH_STAR',
        awardRank: 1,
        rewardTitle: 'Recovery Pack',
        rewardType: 'coupon',
        sponsorName: 'Tour Partner',
        streaks: fixedStreaks
      },
      {
        alias: 'MOVE_MORE',
        awardRank: 2,
        rewardTitle: 'Training Credit',
        rewardType: 'coupon',
        sponsorName: 'Tour Partner',
        streaks: { ...fixedStreaks, daily: 3 }
      }
    ],
    getSettledCompetition: async () => ({
      competitionName: 'Previous GoGymGo Competition',
      monthKey: previousMonthKey(),
      rewardCount: 2
    }),
    planCreatorWorkout: async (workoutId, plannedDate, note) => ({
      creatorName: 'GoGymGo Coach',
      durationMinutes: 30,
      id: `app-tour-plan-${plannedDate}`,
      note: note ?? null,
      plannedDate,
      workoutId,
      workoutName: 'Full Body Circuit',
      workoutStyle: 'Strength + conditioning'
    } satisfies CreatorWorkoutPlan),
    requestWeeklyChallengePartner: async (
      _competitionMonthKey,
      goalDays,
      _region,
      periodIndex
    ) => createWeeklyChallengeRequest(goalDays, periodIndex),
    respondToWeeklyChallengeRequest: async (requestId, decision) => ({
      ...createWeeklyChallengeRequest(4, 1),
      id: requestId,
      status: decision
    }),
    submitCreatorVideo: async (input) => ({
      createdAt: nowIso(),
      id: 'app-tour-video-submission',
      rightsAcceptedAt: nowIso(),
      rightsVersion: 'app-tour',
      status: 'submitted',
      title: input.title,
      videoUrl: input.videoUrl
    } satisfies CreatorVideoSubmission),
    mode: 'tour'
  };
}

export function createAppTourAccountReadinessRepository():
AccountReadinessRepository {
  let enrollment: CompetitionEnrollment = {
    competitionId: appTourCompetitionId,
    enrolledAt: nowIso(),
    goalDays: 4,
    id: appTourEnrollmentId,
    status: 'active'
  };
  let regionVerification = createRegionVerification();
  let legalReceipt = createLegalReceipt();

  return {
    createRegionVerification: async () => {
      regionVerification = createRegionVerification();
      return regionVerification;
    },
    enrollInCompetition: async (competitionId, input) => {
      enrollment = {
        competitionId,
        enrolledAt: nowIso(),
        goalDays: input.goalDays,
        id: appTourEnrollmentId,
        status: 'active'
      };
      return enrollment;
    },
    getCurrentCompetition: async (expectedMonthKey, regionLabel) =>
      createCurrentCompetition(expectedMonthKey, regionLabel),
    getCurrentEnrollment: async () => enrollment,
    getCurrentLegalDocuments: async (jurisdictionCode = 'GLOBAL', locale = 'en') =>
      createLegalBundle(jurisdictionCode, locale),
    getCurrentRegionVerification: async () => regionVerification,
    getLegalReceiptStatus: async (jurisdictionCode = 'GLOBAL', locale = 'en') => ({
      ...legalReceipt,
      jurisdictionCode,
      locale
    }),
    listRegionPolicies: async () => [
      {
        boundaryVersion: 'app-tour',
        code: 'CA-ON-TORONTO',
        competitionEnabled: true,
        countryCode: 'CA',
        currency: 'CAD',
        id: appTourRegionPolicyId,
        languageCodes: ['en'],
        metroName: 'TORONTO',
        minimumAge: 18,
        policyVersion: 'app-tour',
        subdivisionCode: 'ON',
        timezone: 'America/Toronto',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: null
      }
    ],
    recordLegalReceipt: async (bundle) => {
      legalReceipt = {
        ...bundle,
        acceptedAt: nowIso(),
        complete: true,
        receiptBundleId: appTourLegalBundleId
      };
      return legalReceipt;
    }
  };
}

export function createAppTourAccountSettingsRepository():
AccountSettingsRepository {
  let accepted = true;
  let avatar: AvatarMedia | null = null;

  const consent = (): DevicePresenceConsent => ({
    accepted,
    acceptedAt: accepted ? nowIso() : null,
    consentKey: 'device_presence_qr_camera',
    consentVersion: 'app-tour',
    updatedAt: nowIso(),
    withdrawnAt: accepted ? null : nowIso()
  });

  return {
    createPrivacyRequest: async (requestType) => ({
      completedAt: nowIso(),
      downloadAvailable: requestType === 'export',
      exportExpiresAt: requestType === 'export' ? nowIso() : null,
      failureCode: null,
      id: `app-tour-${requestType}`,
      requestedAt: nowIso(),
      requestType,
      status: 'completed'
    }),
    disablePushDevice: async () => undefined,
    getAvatar: async () => ({ active: avatar, latest: avatar }),
    getDevicePresenceConsent: async () => consent(),
    getPrivacyDownload: async () => ({
      expiresAt: nowIso(),
      url: 'data:text/plain,GoGymGo%20App%20Tour%20export'
    }),
    listPrivacyRequests: async () => [],
    registerPushDevice: async (platform) => ({
      enabled: true,
      id: 'app-tour-push-device',
      platform,
      provider: 'expo'
    }),
    removeAvatar: async () => {
      avatar = null;
    },
    setDevicePresenceConsent: async (nextAccepted, consentVersion) => {
      accepted = nextAccepted;
      return { ...consent(), consentVersion };
    },
    uploadAvatar: async (uri) => {
      avatar = {
        contentType: 'image/jpeg',
        createdAt: nowIso(),
        id: 'app-tour-avatar',
        readUrl: uri,
        readUrlExpiresAt: null,
        status: 'approved'
      };
      return {
        state: { active: avatar, latest: avatar },
        status: 'approved'
      };
    }
  };
}

export function createAppTourWorkoutSessionRepository():
WorkoutSessionRepository {
  const sessions = new Map<string, AuthoritativeWorkoutSession>();

  return {
    appendGymQrScan: async () => undefined,
    appendHeartRateSample: async () => undefined,
    cancelSession: async (sessionId) => {
      const session = getOrCreateSession(sessions, sessionId);
      const cancelled = { ...session, status: 'cancelled' as const };
      sessions.set(sessionId, cancelled);
      return cancelled;
    },
    completeSession: async (sessionId) => {
      const session = getOrCreateSession(sessions, sessionId);
      const completed = {
        ...session,
        completedAt: nowIso(),
        eligibleForReview: true,
        status: 'verified' as const,
        violations: []
      };
      sessions.set(sessionId, completed);
      return completed;
    },
    createSession: async () => {
      const id = `app-tour-session-${sessions.size + 1}`;
      const session = createAuthoritativeSession(id);
      sessions.set(id, session);
      return session;
    },
    getCompetitionProgress: async () => createCompetitionProgress()
  };
}

export function createAppTourSocialRepository(): SocialRepository {
  let profile: SocialProfile = {
    screenName: 'APP_TOUR_PLAYER',
    streaks: fixedStreaks,
    userId: appTourUserId
  };
  const friend = {
    friendsSince: '2026-01-15T00:00:00.000Z',
    screenName: 'MOVE_MORE',
    streaks: { ...fixedStreaks, daily: 3 },
    userId: 'app-tour-friend'
  };
  let challenges = [createSocialChallenge()];

  return {
    checkInToChallenge: async (challengeId) => ({
      challengeId,
      checkInId: 'app-tour-check-in',
      eligibleDate: todayKey(),
      source: 'verified_workout'
    }),
    createChallenge: async (input) => {
      const challenge = createSocialChallenge(input);
      challenges = [challenge, ...challenges];
      return challenge;
    },
    discoverRegionalChallenges: async () => challenges,
    getMyProfile: async () => profile,
    inviteContactToChallenge: async (challengeId, contact) => ({
      challengeId,
      channel: contact.channel,
      destinationHint: contact.channel === 'email' ? 't***@example.com' : '***-***-0100',
      expiresAt: nowIso(),
      id: 'app-tour-contact-invite',
      joinUrl: 'https://example.invalid/app-tour-invite'
    }),
    inviteFriendToChallenge: async (challengeId, friendUserId) => ({
      challengeId,
      status: 'pending',
      userId: friendUserId
    }),
    joinRegionalChallenge: async (challengeId) => ({
      challengeId,
      status: 'accepted',
      userId: appTourUserId
    }),
    listChallenges: async () => challenges,
    listFriendRequests: async () => [
      {
        createdAt: nowIso(),
        direction: 'incoming',
        id: 'app-tour-friend-request',
        user: friend
      } satisfies FriendRequest
    ],
    listFriends: async () => [friend],
    redeemContactInvitation: async () => ({
      challengeId: challenges[0].id,
      status: 'accepted',
      userId: appTourUserId
    }),
    respondToChallengeInvitation: async (challengeId, decision) => ({
      challengeId,
      status: decision,
      userId: appTourUserId
    }),
    respondToFriendRequest: async (requestId, decision) => ({
      requestId,
      status: decision
    }),
    searchUsers: async (screenName) => [
      {
        relationship: 'friend',
        screenName: screenName.toUpperCase(),
        streaks: friend.streaks,
        userId: friend.userId
      }
    ],
    sendFriendRequest: async (recipientUserId) => ({
      createdAt: nowIso(),
      direction: 'outgoing',
      id: 'app-tour-sent-request',
      user: { ...friend, userId: recipientUserId }
    }),
    updateScreenName: async (screenName) => {
      profile = { ...profile, screenName };
      return profile;
    }
  };
}

export function createAppTourActiveSession(
  scenario: AppTourScenario,
  verificationMethod: PersistedActiveWorkoutSession['verificationMethod'] = 'heartRate'
): PersistedActiveWorkoutSession | null {
  if (scenario === 'ready') {
    return null;
  }

  const presenceCheck = scenario === 'presence-check';
  const completionReady = scenario === 'workout-complete';
  const elapsedSeconds = completionReady ? 31 * 60 : presenceCheck ? 15 * 60 : 8 * 60;
  const heartRateObservedSeconds = completionReady ? 30 * 60 : elapsedSeconds;
  const averageHeartRateBpm = 118;

  return {
    averageHeartRateBpm,
    dateKey: todayKey(),
    heartRateObservedSeconds,
    heartRateTotalBpmSeconds: averageHeartRateBpm * heartRateObservedSeconds,
    id: 'app-tour-active-session',
    lastHeartRateSampleElapsedSeconds: heartRateObservedSeconds,
    midSessionCheckAtSeconds: 10 * 60,
    midSessionCheckPrompted: presenceCheck,
    midSessionCheckPromptedAt: presenceCheck ? nowIso() : null,
    midSessionVerified: completionReady,
    serverManaged: true,
    startedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
    verificationMethod
  };
}

export function createAppTourReadyWorkoutSession(
  verificationMethod: PersistedActiveWorkoutSession['verificationMethod']
) {
  return createAppTourActiveSession('workout-complete', verificationMethod);
}

function createCurrentCompetition(
  monthKey: string,
  regionName: string
): CurrentCompetition {
  const { end, start } = monthWindow(monthKey);

  return {
    endsAt: end,
    goalDays: [1, 2, 3, 4, 5, 6, 7],
    id: appTourCompetitionId,
    monthKey,
    name: `${regionName} Monthly Competition`,
    regionCode: 'CA-ON-TORONTO',
    regionName,
    registrationClosesAt: end,
    registrationOpensAt: start,
    rules: {
      minHeartRateSamples: 0,
      minSessionMinutes: 30,
      requireDeviceAttestation: false,
      requireFaceCheck: false,
      requireGymQr: false,
      signupPrizeDrawEntries: 1,
      verifiedSessionCategoryScore: 1,
      verifiedSessionPrizeDrawEntries: 1
    },
    rulesVersion: 'app-tour',
    startsAt: start,
    status: 'active'
  };
}

function createRegionVerification(): RegionVerification {
  return {
    createdAt: nowIso(),
    expiresAt: null,
    id: appTourRegionVerificationId,
    method: 'device_location',
    policyVersion: 'app-tour',
    regionCode: 'CA-ON-TORONTO',
    regionName: 'TORONTO',
    regionPolicyId: appTourRegionPolicyId,
    reviewedAt: nowIso(),
    status: 'approved'
  };
}

function createLegalBundle(
  jurisdictionCode = 'GLOBAL',
  locale = 'en'
): CurrentLegalDocuments {
  return {
    bundleSha256: 'app-tour-legal-bundle',
    configured: true,
    documents: [
      {
        content: {
          intro: 'This document is displayed only inside the development App Tour.',
          sections: [
            {
              body: 'No acceptance from App Tour is sent to the GoGymGo backend.',
              heading: 'Testing mode'
            }
          ]
        },
        contentSha256: 'app-tour-privacy',
        documentKey: 'privacy-policy',
        effectiveAt: '2026-01-01T00:00:00.000Z',
        id: 'app-tour-privacy',
        jurisdictionCode,
        locale,
        receiptRequirement: 'acknowledge',
        title: 'Privacy Policy',
        version: 'app-tour'
      },
      {
        content: {
          intro: 'This document is displayed only inside the development App Tour.',
          sections: [
            {
              body: 'Testing-mode actions are local and are not real competition entries.',
              heading: 'Testing mode'
            }
          ]
        },
        contentSha256: 'app-tour-terms',
        documentKey: 'terms-of-service',
        effectiveAt: '2026-01-01T00:00:00.000Z',
        id: 'app-tour-terms',
        jurisdictionCode,
        locale,
        receiptRequirement: 'accept',
        title: 'Terms of Service',
        version: 'app-tour'
      }
    ],
    jurisdictionCode,
    locale
  };
}

function createLegalReceipt(): LegalReceiptStatus {
  return {
    ...createLegalBundle(),
    acceptedAt: nowIso(),
    complete: true,
    receiptBundleId: appTourLegalBundleId
  };
}

function createCompetitionProgress(): CompetitionProgress {
  const monthKey = currentMonthKey();
  const verifiedDateKeys = ['02', '05', '09'].map((day) => `${monthKey}-${day}`);
  const sessions = verifiedDateKeys.map((dateKey, index) => ({
    completedAt: `${dateKey}T13:30:00.000Z`,
    eligibleDate: dateKey,
    id: `app-tour-verified-${index + 1}`,
    startedAt: `${dateKey}T13:00:00.000Z`,
    status: 'verified' as const
  }));

  return {
    categoryScore: 3,
    competitionId: appTourCompetitionId,
    enrolledDateKey: `${monthKey}-01`,
    goalDays: 4,
    monthKey,
    prizeDrawEntries: 12,
    sessions,
    updatedAt: nowIso(),
    verifiedDateKeys,
    verifiedDays: verifiedDateKeys.length
  };
}

function createAuthoritativeSession(id: string): AuthoritativeWorkoutSession {
  return {
    completedAt: null,
    competitionId: appTourCompetitionId,
    eligibleDate: todayKey(),
    id,
    policyVersion: 'app-tour',
    startedAt: nowIso(),
    status: 'active'
  };
}

function getOrCreateSession(
  sessions: Map<string, AuthoritativeWorkoutSession>,
  id: string
) {
  const existing = sessions.get(id);
  if (existing) {
    return existing;
  }

  const session = createAuthoritativeSession(id);
  sessions.set(id, session);
  return session;
}

function createLeaderboard(goal: GoalCategory): CategoryLeaderboard {
  return {
    goal,
    rows: [
      {
        alias: 'NORTH_STAR',
        categoryEntries: 84,
        rank: 1,
        streaks: fixedStreaks,
        verifiedDays: 18
      },
      {
        alias: 'APP_TOUR_PLAYER',
        categoryEntries: 72,
        rank: 2,
        streaks: { ...fixedStreaks, daily: 4 },
        verifiedDays: 16
      },
      {
        alias: 'MOVE_MORE',
        categoryEntries: 63,
        rank: 3,
        streaks: { ...fixedStreaks, daily: 3 },
        verifiedDays: 15
      }
    ]
  };
}

function createCompetitionMatches(
  monthKey: string,
  region: string
): readonly CompetitionMatch[] {
  return ([1, 2, 3, 4] as const).map((periodIndex) => ({
    availability: 'matched',
    opponentAlias: periodIndex % 2 === 0 ? 'MOVE_MORE' : 'NORTH_STAR',
    opponentBestStreak: 8,
    opponentCurrentStreak: 3,
    opponentMonthlyVerifiedDays: 14,
    opponentStreaks: fixedStreaks,
    opponentUserId: `app-tour-opponent-${periodIndex}`,
    opponentVerifiedDateKeys: [
      `${monthKey}-${String((periodIndex - 1) * 7 + 2).padStart(2, '0')}`,
      `${monthKey}-${String((periodIndex - 1) * 7 + 4).padStart(2, '0')}`,
      `${monthKey}-${String((periodIndex - 1) * 7 + 6).padStart(2, '0')}`
    ],
    periodIndex,
    region
  }));
}

function createWeeklyChallengeRequest(
  goalDays: number,
  periodIndex: number
): WeeklyChallengeRequest {
  return {
    competitionId: appTourCompetitionId,
    createdAt: nowIso(),
    direction: 'incoming',
    goalDays,
    id: 'app-tour-weekly-request',
    partnerAlias: 'MOVE_MORE',
    partnerStreaks: fixedStreaks,
    partnerUserId: 'app-tour-friend',
    periodIndex: normalizePeriodIndex(periodIndex),
    status: 'pending'
  };
}

function normalizePeriodIndex(value: number): CompetitionPeriodIndex {
  if (value === 2 || value === 3 || value === 4) {
    return value;
  }
  return 1;
}

function createSocialChallenge(
  input?: CreateSocialChallengeInput
): SocialChallenge {
  const month = monthWindow(currentMonthKey());
  const targetCount = input?.targetCount ?? 4;

  return {
    activity: input?.activity ?? 'gym',
    activityLabel: input?.activityLabel ?? 'Gym visits',
    challengeType: input?.challengeType ?? 'friend',
    createdAt: nowIso(),
    description: input?.description ?? 'A local App Tour challenge.',
    endDate: input?.endDate ?? month.end.slice(0, 10),
    id: `app-tour-challenge-${Date.now()}`,
    locationName: input?.locationName ?? null,
    members: [
      {
        ...appTourUser,
        progress: {
          completedCount: 2,
          completionPercent: 50,
          targetTotal: targetCount
        },
        role: 'owner',
        screenName: 'APP_TOUR_PLAYER',
        status: 'accepted',
        streaks: fixedStreaks,
        userId: appTourUserId
      }
    ],
    myProgress: {
      completedCount: 2,
      completionPercent: 50,
      targetTotal: targetCount
    },
    myRole: 'owner',
    myStatus: 'accepted',
    name: input?.name ?? 'Four Visit Challenge',
    ownerScreenName: 'APP_TOUR_PLAYER',
    ownerStreaks: fixedStreaks,
    ownerUserId: appTourUserId,
    participantCount: 1,
    participantLimit: input?.participantLimit ?? null,
    regionCode: input?.regionCode ?? 'CA-ON-TORONTO',
    regionName: 'TORONTO',
    scheduledDays: input?.scheduledDays ?? [1, 3, 5],
    scheduledTime: input?.scheduledTime ?? '18:00',
    startDate: input?.startDate ?? month.start.slice(0, 10),
    targetCount,
    targetPeriod: input?.targetPeriod ?? 'weekly',
    timezone: 'America/Toronto'
  };
}

function monthWindow(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  return { end, start };
}

function currentMonthKey() {
  return todayKey().slice(0, 7);
}

function previousMonthKey() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}
