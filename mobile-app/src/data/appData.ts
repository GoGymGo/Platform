import type { GoalCategory } from '@/domain/campaignEconomics';
import type {
  CompetitionMatch,
  EligibleWeeklyChallengePartner,
  WeeklyChallengeRequest
} from '@/domain/competition';
import type {
  CreateCreatorVideoSubmissionInput,
  CreatorVideoSubmission,
  CreatorWorkoutPlan
} from '@/domain/creatorWorkouts';
import type {
  ClaimedReward,
  RewardAward,
  RewardCatalogItem,
  RewardWinner,
  SettledCompetitionSummary
} from '@/domain/rewards';
import type { StreakSummary } from '@/domain/streaks';
import { buildCompetitionMatchPreview } from '@/mocks/competitionPreview';
import {
  getCategoryLeaderboard,
  type CategoryLeaderboard
} from '@/mocks/competitionResults';
import {
  rewardAwardsPreview,
  rewardCatalogPreview,
  rewardWinnersPreview,
  settledCompetitionPreview
} from '@/mocks/rewards';
import {
  creatorWorkoutPreviews,
  type CreatorWorkoutPreview
} from '@/mocks/creatorWorkouts';
import {
  getSessionTelemetryPreview,
  type SessionTelemetryPreview
} from '@/mocks/sessionTelemetry';
import { getStreakSummaryPreview } from '@/mocks/streaks';
import type { ApiClient } from '@/services/api/client';

export type {
  CategoryLeaderboard,
  CategoryLeaderboardRow
} from '@/mocks/competitionResults';
export type { CreatorWorkoutPreview } from '@/mocks/creatorWorkouts';

export type AppDataMode = 'api' | 'demo' | 'unavailable';

export type AppDataSource = {
  claimReward: (
    awardId: string,
    idempotencyKey: string
  ) => Promise<ClaimedReward>;
  getCategoryLeaderboard: (goal: GoalCategory) => Promise<CategoryLeaderboard | null>;
  getCompetitionMatches: (
    competitionMonthKey: string,
    weeklyGoal: number,
    region: string
  ) => Promise<readonly CompetitionMatch[]>;
  getCompetitionEnrollmentCount: (
    region: string,
    competitionMonthKey: string
  ) => Promise<number | null>;
  getCreatorWorkouts: () => Promise<readonly CreatorWorkoutPreview[]>;
  getCreatorWorkoutPlans: () => Promise<readonly CreatorWorkoutPlan[]>;
  getEligibleWeeklyChallengePartners: (
    competitionMonthKey: string,
    weeklyGoal: number,
    region: string,
    periodIndex: number
  ) => Promise<readonly EligibleWeeklyChallengePartner[]>;
  getWeeklyChallengeRequests: (
    competitionMonthKey: string,
    weeklyGoal: number,
    region: string,
    periodIndex: number
  ) => Promise<readonly WeeklyChallengeRequest[]>;
  getMyRewardAwards: () => Promise<readonly RewardAward[]>;
  getMyStreaks: () => Promise<StreakSummary | null>;
  getRewardCatalog: (
    region: string,
    monthKey?: string
  ) => Promise<readonly RewardCatalogItem[]>;
  getRewardWinners: () => Promise<readonly RewardWinner[]>;
  getSessionTelemetry: (elapsedSeconds: number) => SessionTelemetryPreview | null;
  getSettledCompetition: () => Promise<SettledCompetitionSummary | null>;
  planCreatorWorkout: (
    workoutId: string,
    plannedDate: string,
    note?: string
  ) => Promise<CreatorWorkoutPlan>;
  requestWeeklyChallengePartner: (
    competitionMonthKey: string,
    weeklyGoal: number,
    region: string,
    periodIndex: number,
    recipientUserId: string
  ) => Promise<WeeklyChallengeRequest>;
  respondToWeeklyChallengeRequest: (
    requestId: string,
    decision: 'accepted' | 'declined'
  ) => Promise<WeeklyChallengeRequest>;
  submitCreatorVideo: (
    input: CreateCreatorVideoSubmissionInput
  ) => Promise<CreatorVideoSubmission>;
  mode: AppDataMode;
};

export function createAppDataSource(
  mode: AppDataMode,
  api: ApiClient | null = null
): AppDataSource {
  if (mode === 'api' && !api) {
    throw new Error('The API data source requires a configured API client.');
  }

  return {
    claimReward: (awardId, idempotencyKey) => {
      if (mode === 'api') {
        return requireApi(api).request<ClaimedReward>(
          `/v1/rewards/awards/${encodeURIComponent(awardId)}/claim`,
          { idempotencyKey, method: 'POST' }
        );
      }
      const award = rewardAwardsPreview.find((item) => item.id === awardId);
      if (!award) return Promise.reject(new Error('Reward award not found.'));
      return Promise.resolve({
        ...award,
        claimedAt: new Date().toISOString(),
        claimUrl: null,
        couponCode: award.rewardType === 'coupon' ? 'DEMO-REWARD-25' : null,
        fulfillmentInstructions:
          award.rewardType === 'physical'
            ? 'The sponsor will contact you with pickup instructions.'
            : null,
        status: 'claimed'
      });
    },
    getCategoryLeaderboard: (goal) => {
      if (mode === 'demo') return Promise.resolve(getCategoryLeaderboard(goal));
      if (mode === 'api') {
        return requireApi(api).request<CategoryLeaderboard>(
          `/v1/leaderboards/current?goal=${goal}`
        );
      }
      return Promise.resolve(null);
    },
    getCompetitionMatches: (competitionMonthKey, weeklyGoal, region) => {
      if (mode === 'demo') {
        return Promise.resolve(
          buildCompetitionMatchPreview(competitionMonthKey, weeklyGoal).map((match) => ({
            ...match,
            region
          }))
        );
      }
      if (mode === 'api') {
        return requireApi(api).request<readonly CompetitionMatch[]>(
          `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
          `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}`
        );
      }
      return Promise.resolve([]);
    },
    getCompetitionEnrollmentCount: (region, competitionMonthKey) => {
      if (mode === 'demo') return Promise.resolve(84);
      if (mode === 'api') {
        return requireApi(api)
          .request<{ count: number }>(
            `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/enrollment-count` +
            `?region=${encodeURIComponent(region)}`,
            { authenticated: false }
          )
          .then(({ count }) => count);
      }
      return Promise.resolve(null);
    },
    getCreatorWorkouts: () => {
      if (mode === 'demo') return Promise.resolve(creatorWorkoutPreviews);
      if (mode === 'api') {
        return requireApi(api).request<readonly CreatorWorkoutPreview[]>(
          '/v1/creator-workouts'
        );
      }
      return Promise.resolve([]);
    },
    getCreatorWorkoutPlans: () => {
      if (mode === 'demo') return Promise.resolve(demoCreatorWorkoutPlans);
      if (mode === 'api') {
        return requireApi(api).request<readonly CreatorWorkoutPlan[]>(
          '/v1/creator-workouts/plans/me'
        );
      }
      return Promise.resolve([]);
    },
    getEligibleWeeklyChallengePartners: (
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex
    ) => {
      if (mode === 'demo') return Promise.resolve(demoEligibleWeeklyPartners);
      if (mode === 'api') {
        return requireApi(api).request<readonly EligibleWeeklyChallengePartner[]>(
          `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/eligible-partners` +
          `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}&period=${periodIndex}`
        );
      }
      return Promise.resolve([]);
    },
    getWeeklyChallengeRequests: (
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex
    ) => {
      if (mode === 'demo') return Promise.resolve(demoWeeklyChallengeRequests);
      if (mode === 'api') {
        return requireApi(api).request<readonly WeeklyChallengeRequest[]>(
          `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests` +
          `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}&period=${periodIndex}`
        );
      }
      return Promise.resolve([]);
    },
    getMyRewardAwards: () => {
      if (mode === 'demo') return Promise.resolve(rewardAwardsPreview);
      if (mode === 'api') {
        return requireApi(api).request<readonly RewardAward[]>('/v1/rewards/awards/me');
      }
      return Promise.resolve([]);
    },
    getMyStreaks: () => {
      if (mode === 'demo') return Promise.resolve(getStreakSummaryPreview());
      if (mode === 'api') {
        return requireApi(api).request<StreakSummary>('/v1/streaks/me');
      }
      return Promise.resolve(null);
    },
    getRewardCatalog: (region, monthKey) => {
      if (mode === 'demo') return Promise.resolve(rewardCatalogPreview);
      if (mode === 'api') {
        const query = new URLSearchParams({ region });
        if (monthKey) query.set('monthKey', monthKey);
        return requireApi(api).request<readonly RewardCatalogItem[]>(
          `/v1/rewards/catalog?${query.toString()}`,
          { authenticated: false }
        );
      }
      return Promise.resolve([]);
    },
    getRewardWinners: () => {
      if (mode === 'demo') return Promise.resolve(rewardWinnersPreview);
      if (mode === 'api') {
        return requireApi(api).request<readonly RewardWinner[]>(
          '/v1/results/reward-winners',
          { authenticated: false }
        );
      }
      return Promise.resolve([]);
    },
    getSessionTelemetry: (elapsedSeconds) =>
      mode === 'demo' ? getSessionTelemetryPreview(elapsedSeconds) : null,
    getSettledCompetition: () => {
      if (mode === 'demo') return Promise.resolve(settledCompetitionPreview);
      if (mode === 'api') {
        return requireApi(api).request<SettledCompetitionSummary | null>(
          '/v1/results/settled-competition',
          { authenticated: false }
        );
      }
      return Promise.resolve(null);
    },
    planCreatorWorkout: (workoutId, plannedDate, note) => {
      if (mode === 'demo') {
        const workout = creatorWorkoutPreviews.find(({ id }) => id === workoutId);
        if (!workout) return Promise.reject(new Error('Creator workout not found.'));
        const plan: CreatorWorkoutPlan = {
          creatorName: workout.creatorName,
          durationMinutes: workout.durationMinutes,
          id: `preview-plan-${workoutId}-${plannedDate}`,
          note: note?.trim() || null,
          plannedDate,
          workoutId,
          workoutName: workout.name,
          workoutStyle: workout.workoutStyle
        };
        const existingIndex = demoCreatorWorkoutPlans.findIndex((item) =>
          item.workoutId === workoutId && item.plannedDate === plannedDate
        );
        if (existingIndex >= 0) demoCreatorWorkoutPlans[existingIndex] = plan;
        else demoCreatorWorkoutPlans.push(plan);
        return Promise.resolve(plan);
      }
      if (mode === 'api') {
        return requireApi(api).request<CreatorWorkoutPlan, { note?: string; plannedDate: string }>(
          `/v1/creator-workouts/${encodeURIComponent(workoutId)}/plans`,
          {
            body: { note, plannedDate },
            idempotencyKey: createIdempotencyKey('creator-plan'),
            method: 'POST'
          }
        );
      }
      return Promise.reject(new Error('Creator workout planning is unavailable.'));
    },
    requestWeeklyChallengePartner: (
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex,
      recipientUserId
    ) => {
      if (mode === 'demo') {
        const partner = demoEligibleWeeklyPartners.find(({ userId }) => userId === recipientUserId);
        if (!partner) return Promise.reject(new Error('That partner is not eligible.'));
        const request: WeeklyChallengeRequest = {
          competitionId: 'preview-competition',
          createdAt: new Date().toISOString(),
          direction: 'outgoing',
          goalDays: weeklyGoal,
          id: `preview-weekly-request-${Date.now()}`,
          partnerAlias: partner.alias,
          partnerStreaks: partner.streaks,
          partnerUserId: partner.userId,
          periodIndex: periodIndex as 1 | 2 | 3 | 4,
          status: 'pending'
        };
        demoWeeklyChallengeRequests.push(request);
        partner.requestStatus = 'pending';
        return Promise.resolve(request);
      }
      if (mode === 'api') {
        return requireApi(api).request<WeeklyChallengeRequest, {
          goal: number;
          period: number;
          recipientUserId: string;
          region: string;
        }>(
          `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests`,
          {
            body: { goal: weeklyGoal, period: periodIndex, recipientUserId, region },
            idempotencyKey: createIdempotencyKey('weekly-challenge'),
            method: 'POST'
          }
        );
      }
      return Promise.reject(new Error('Weekly Challenge requests are unavailable.'));
    },
    respondToWeeklyChallengeRequest: (requestId, decision) => {
      if (mode === 'demo') {
        const index = demoWeeklyChallengeRequests.findIndex(({ id }) => id === requestId);
        const request = demoWeeklyChallengeRequests[index];
        if (!request) return Promise.reject(new Error('Weekly Challenge request not found.'));
        const updated = { ...request, status: decision } as WeeklyChallengeRequest;
        demoWeeklyChallengeRequests.splice(index, 1);
        return Promise.resolve(updated);
      }
      if (mode === 'api') {
        return requireApi(api).request<WeeklyChallengeRequest, { decision: 'accepted' | 'declined' }>(
          `/v1/competitions/weekly-challenges/requests/${encodeURIComponent(requestId)}`,
          {
            body: { decision },
            idempotencyKey: createIdempotencyKey('weekly-challenge-response'),
            method: 'PATCH'
          }
        );
      }
      return Promise.reject(new Error('Weekly Challenge requests are unavailable.'));
    },
    submitCreatorVideo: (input) => {
      if (mode === 'demo') {
        return Promise.resolve({
          createdAt: new Date().toISOString(),
          id: `preview-submission-${Date.now()}`,
          rightsAcceptedAt: new Date().toISOString(),
          rightsVersion: 'creator-video-rights-v1',
          status: 'submitted',
          title: input.title,
          videoUrl: input.videoUrl
        });
      }
      if (mode === 'api') {
        return requireApi(api).request<CreatorVideoSubmission, CreateCreatorVideoSubmissionInput>(
          '/v1/creator-workouts/submissions',
          {
            body: input,
            idempotencyKey: createIdempotencyKey('creator-submission'),
            method: 'POST'
          }
        );
      }
      return Promise.reject(new Error('Creator video submissions are unavailable.'));
    },
    mode
  };
}

const demoEligibleWeeklyPartners: EligibleWeeklyChallengePartner[] = [
  {
    alias: 'NOVA_LIFT',
    goalDays: 4,
    requestStatus: 'available',
    streaks: { daily: 4, monthly: 1, weekly: 3, yearly: 0 },
    userId: 'preview-nova-lift'
  },
  {
    alias: 'KIRA_PULSE',
    goalDays: 4,
    requestStatus: 'available',
    streaks: { daily: 9, monthly: 3, weekly: 6, yearly: 1 },
    userId: 'preview-kira-pulse'
  }
];

const demoWeeklyChallengeRequests: WeeklyChallengeRequest[] = [];
const demoCreatorWorkoutPlans: CreatorWorkoutPlan[] = [];

let appDataIdempotencySequence = 0;
function createIdempotencyKey(scope: string) {
  appDataIdempotencySequence += 1;
  return `${scope}-${Date.now().toString(36)}-${appDataIdempotencySequence.toString(36)}`;
}

function requireApi(api: ApiClient | null): ApiClient {
  if (!api) throw new Error('GoGymGo API client is unavailable.');
  return api;
}
