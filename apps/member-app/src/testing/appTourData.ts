import type { GymScanResultDto } from '@gogymgo/contracts';

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
  CompetitionProgress,
  StartedWorkoutSession
} from '@/domain/session';
import type {
  CreateSocialChallengeInput,
  FriendRequest,
  SocialChallenge,
  SocialProfile
} from '@/domain/social';
import type { AccountProfile, PublicIdentity } from '@/domain/profile';
import type { PersistedActiveWorkoutSession } from '@/domain/workoutProgress';
import type { PendingGymScan } from '@/services/pendingGymScan';
import type { AuthenticatedUser } from '@/state/auth';
import type { AppTourScenario } from '@/state/appTour';

const appTourCompetitionId = '10000000-0000-4000-8000-000000000001';
const appTourEnrollmentId = '10000000-0000-4000-8000-000000000002';
const appTourRegionPolicyId = '10000000-0000-4000-8000-000000000003';
const appTourRegionVerificationId = '10000000-0000-4000-8000-000000000004';
const appTourLegalBundleId = '10000000-0000-4000-8000-000000000005';
const appTourUserId = 'app-tour-player';
export const appTourAuthToken = 'app-tour-token';
const appTourCompetitionMonthKey = '2026-09';
export const appTourCompetitionRegistrationEvidence = {
  gymPresence: {
    accuracyMeters: 5,
    credential: 'app-tour-gym-credential-000000000001',
    latitude: 49.2827,
    longitude: -123.1207
  },
  legalReceiptBundleId: 'app-tour-legal-receipt',
  regionVerificationId: 'app-tour-region-verification'
} as const;
export const appTourPresenceConfirmationMessage =
  'Presence confirmed in the browser preview.';
export const appTourPublicIdentity: PublicIdentity = {
  callsign: 'PULSE_RIDER',
  displayName: 'PULSE_RIDER',
  mode: 'alias'
};
export const appTourSimulatedHeartRateBpm = 118;
const fixedStreaks = {
  daily: 4,
  monthly: 2,
  weekly: 3,
  yearly: 1
} as const;

export const appTourUser: AuthenticatedUser = {
  displayName: 'Preview Player',
  email: 'preview.player@example.com',
  emailVerified: true,
  photoUrl: null,
  providerIds: ['password'],
  uid: appTourUserId
};

export type AppTourQrMode = 'entry' | 'exit';

export function createAppTourGymQrPayload(mode: AppTourQrMode) {
  return `app-tour-gym-${mode}-credential-000000000001`;
}

export function createAppTourPendingGymScan(
  scenario: AppTourScenario,
  now = Date.now()
): PendingGymScan {
  const workoutActive = scenario === 'active-workout' || scenario === 'presence-check';
  const elapsedSeconds = scenario === 'presence-check' ? 31 * 60 : 8 * 60;
  const startedAt = now - elapsedSeconds * 1000;

  return {
    activeSession: workoutActive
      ? {
          expiresAt: new Date(startedAt + 4 * 60 * 60 * 1000).toISOString(),
          gymName: 'SKYGATE',
          minimumCompleteAt: new Date(startedAt + 30 * 60 * 1000).toISOString(),
          sessionId: 'app-tour-gym-session',
          startedAt: new Date(startedAt).toISOString()
        }
      : null,
    competitionId: 'app-tour-competition',
    credential: createAppTourGymQrPayload('entry'),
    credentialValidUntil: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now
  };
}

export function createAppTourVerifiedGymLocationResult(
  now = Date.now()
): GymScanResultDto {
  const startedAt = now - 31 * 60 * 1000;

  return {
    credentialVersion: 1,
    expiresAt: new Date(startedAt + 4 * 60 * 60 * 1000).toISOString(),
    gymLocationId: 'app-tour-gym',
    gymName: 'SKYGATE',
    minimumCompleteAt: new Date(startedAt + 30 * 60 * 1000).toISOString(),
    outcome: 'verified',
    rejectionReason: null,
    remainingSeconds: 0,
    serverTimestamp: new Date(now).toISOString(),
    sessionId: 'app-tour-gym-session',
    startedAt: new Date(startedAt).toISOString()
  };
}

export function createAppTourStartedGymLocationResult(
  now = Date.now()
): GymScanResultDto {
  return {
    credentialVersion: 1,
    expiresAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
    gymLocationId: 'app-tour-gym',
    gymName: 'SKYGATE',
    minimumCompleteAt: new Date(now + 30 * 60 * 1000).toISOString(),
    outcome: 'started',
    rejectionReason: null,
    remainingSeconds: 30 * 60,
    serverTimestamp: new Date(now).toISOString(),
    sessionId: 'app-tour-gym-session',
    startedAt: new Date(now).toISOString()
  };
}

export function isAppTourGymQrPayload(
  payload: string,
  mode: AppTourQrMode
) {
  return payload === createAppTourGymQrPayload(mode);
}

export function createAppTourDataSource(): AppDataSource {
  const awards: RewardAward[] = [
    {
      awardRank: 1,
      awardedAt: nowIso(),
      claimedAt: null,
      id: 'app-tour-award',
      imageUrl: null,
      rewardType: 'coupon',
      sponsorName: 'Northline Wellness',
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
        couponCode: 'RECOVER20',
        fulfillmentInstructions: 'Use this sample code during the browser preview.',
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
        name: 'Full Body Circuit',
        regionCodes: ['vancouver-island-gulf-islands-bc'],
        reward: 'Completion badge',
        sponsorName: 'Northline Wellness',
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
      timezone: 'America/Vancouver'
    }),
    getRewardCatalog: async (region, monthKey = currentMonthKey()) => [
      {
        competitionId: appTourCompetitionId,
        competitionName: 'Monthly GoGymGo Contest',
        description: 'A recovery-focused coupon reward for active GoGymGo players.',
        id: 'app-tour-reward',
        imageUrl: null,
        inventoryRemaining: 12,
        inventoryTotal: 20,
        monthKey,
        regionCode: 'vancouver-island-gulf-islands-bc',
        regionName: region,
        rewardType: 'coupon',
        sponsorName: 'Northline Wellness',
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
        sponsorName: 'Northline Wellness',
        streaks: fixedStreaks
      },
      {
        alias: 'MOVE_MORE',
        awardRank: 2,
        rewardTitle: 'Training Credit',
        rewardType: 'coupon',
        sponsorName: 'Northline Wellness',
        streaks: { ...fixedStreaks, daily: 3 }
      }
    ],
    getSettledCompetition: async () => ({
      competitionName: 'Previous GoGymGo Contest',
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

export function createAppTourAccountReadinessRepository(
  scenario: AppTourScenario = 'ready'
):
AccountReadinessRepository {
  const newPlayer = scenario === 'new-player';
  let enrollment: CompetitionEnrollment | null = newPlayer
    ? null
    : {
        competitionId: appTourCompetitionId,
        enrolledAt: nowIso(),
        goalDays: 4,
        id: appTourEnrollmentId,
        status: 'active'
      };
  let legalReceipt = newPlayer
    ? createUnacceptedLegalReceipt()
    : createLegalReceipt();
  let regionVerification: RegionVerification | null = newPlayer
    ? null
    : createRegionVerification();

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
    getCurrentCompetition: async (expectedMonthKey) =>
      createCurrentCompetition(
        expectedMonthKey ?? appTourCompetitionMonthKey,
        'VANCOUVER ISLAND + GULF ISLANDS'
      ),
    getCurrentEnrollment: async () => enrollment,
    getCurrentRegionVerification: async () => regionVerification,
    getCurrentLegalDocuments: async (jurisdictionCode = 'GLOBAL', locale = 'en') =>
      createLegalBundle(jurisdictionCode, locale),
    getLegalReceiptStatus: async (jurisdictionCode = 'GLOBAL', locale = 'en') => ({
      ...legalReceipt,
      jurisdictionCode,
      locale
    }),
    recordLegalReceipt: async (bundle) => {
      legalReceipt = {
        ...bundle,
        acceptedAt: nowIso(),
        complete: true,
        receiptBundleId: appTourLegalBundleId
      };
      return legalReceipt;
    },
    resolveCompetitionByGymQr: async () =>
      createCurrentCompetition(
        appTourCompetitionMonthKey,
        'VANCOUVER ISLAND + GULF ISLANDS'
      ),
    withdrawFromCompetition: async (competitionId) => {
      const withdrawn = {
        ...(enrollment ?? {
          competitionId,
          enrolledAt: nowIso(),
          goalDays: 3,
          id: appTourEnrollmentId
        }),
        status: 'withdrawn' as const
      };
      enrollment = null;
      return withdrawn;
    }
  };
}

export function createAppTourAccountSettingsRepository():
AccountSettingsRepository {
  let accepted = true;
  let avatar: AvatarMedia | null = null;
  let accountProfile: AccountProfile = {
    callsign: appTourPublicIdentity.callsign,
    publicIdentityMode: appTourPublicIdentity.mode,
    publicName: appTourPublicIdentity.displayName,
    screenName: appTourPublicIdentity.displayName
  };

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
    getProfile: async () => accountProfile,
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
    updateProfile: async (input) => {
      accountProfile = {
        ...accountProfile,
        ...input
      };
      return accountProfile;
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
    appendPresenceCheck: async () => undefined,
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
      return {
        ...session,
        requirements: {
          minHeartRateSamples: 0,
          minSessionMinutes: 30,
          requireDeviceAttestation: false,
          requireGymQr: false,
          requirePresenceCheck: true
        }
      } satisfies StartedWorkoutSession;
    },
    getCompetitionProgress: async () => createCompetitionProgress()
  };
}

export function createAppTourSocialRepository(): SocialRepository {
  let profile: SocialProfile = {
    screenName: 'PULSE_RIDER',
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
  if (scenario === 'new-player' || scenario === 'ready') {
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
    heartRateSamplesSubmitted: completionReady ? 60 : Math.floor(elapsedSeconds / 30),
    heartRateTotalBpmSeconds: averageHeartRateBpm * heartRateObservedSeconds,
    id: 'app-tour-active-session',
    lastHeartRateSampleElapsedSeconds: heartRateObservedSeconds,
    minimumSessionSeconds: 30 * 60,
    midSessionCheckAtSeconds: 10 * 60,
    midSessionCheckPrompted: presenceCheck,
    midSessionCheckPromptedAt: presenceCheck ? nowIso() : null,
    midSessionVerified: completionReady,
    policyVersion: 'app-tour',
    presenceCheckRequired: true,
    requiredHeartRateSamples: 0,
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
    entrantCap: null,
    goalDays: [1, 2, 3, 4, 5, 6, 7],
    id: appTourCompetitionId,
    minimumEntrants: 1,
    monthKey,
    name: `${regionName} Monthly Contest`,
    regionCode: 'vancouver-island-gulf-islands-bc',
    regionName,
    registrationClosesAt: end,
    registrationOpensAt: start,
    rules: {
      categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
      minHeartRateSamples: 0,
      minSessionMinutes: 30,
      perfectMonthMultiplier: 10,
      requireDeviceAttestation: false,
      requirePresenceCheck: true,
      requireGymQr: false,
      signupPrizeDrawEntries: 1,
      verifiedSessionCategoryScore: 1,
      verifiedSessionPrizeDrawEntries: 1,
      weeklyChallengeBothHitMultiplier: 2,
      weeklyChallengeRecoveryMultiplier: 3
    },
    rulesVersion: 'app-tour',
    startsAt: start,
    status: 'active'
  };
}

function createRegionVerification(): RegionVerification {
  return {
    createdAt: nowIso(),
    expiresAt: '2099-01-01T00:00:00.000Z',
    id: appTourRegionVerificationId,
    jurisdictionCode: 'CA-BC',
    method: 'device_location',
    policyVersion: 'app-tour',
    regionCode: 'vancouver-island-gulf-islands-bc',
    regionName: 'VANCOUVER ISLAND + GULF ISLANDS',
    regionPolicyId: appTourRegionPolicyId,
    reviewedAt: nowIso(),
    status: 'approved',
    timezone: 'America/Vancouver'
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
          intro: 'This sample notice explains how the browser preview behaves.',
          sections: [
            {
              body: 'Preview agreements stay in this browser and do not create real contest entries.',
              heading: 'Browser preview'
            }
          ]
        },
        contentSha256: 'app-tour-privacy',
        documentKey: 'privacy_policy',
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
          intro: 'These sample terms support the browser preview experience.',
          sections: [
            {
              body: 'Preview actions are local and are not real contest entries.',
              heading: 'Browser preview'
            }
          ]
        },
        contentSha256: 'app-tour-terms',
        documentKey: 'terms_of_service',
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

function createUnacceptedLegalReceipt(): LegalReceiptStatus {
  return {
    ...createLegalBundle(),
    acceptedAt: null,
    complete: false,
    receiptBundleId: null
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
        alias: 'PULSE_RIDER',
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
    description: input?.description ?? 'A local four-visit fitness challenge.',
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
        screenName: 'PULSE_RIDER',
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
    ownerScreenName: 'PULSE_RIDER',
    ownerStreaks: fixedStreaks,
    ownerUserId: appTourUserId,
    participantCount: 1,
    participantLimit: input?.participantLimit ?? null,
    regionCode: input?.regionCode ?? 'vancouver-island-gulf-islands-bc',
    regionName: 'VANCOUVER ISLAND + GULF ISLANDS',
    scheduledDays: input?.scheduledDays ?? [1, 3, 5],
    scheduledTime: input?.scheduledTime ?? '18:00',
    startDate: input?.startDate ?? month.start.slice(0, 10),
    targetCount,
    targetPeriod: input?.targetPeriod ?? 'weekly',
    timezone: 'America/Vancouver'
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
