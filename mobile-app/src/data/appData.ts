import type { GoalCategory } from '@/domain/campaignEconomics';
import type {
  CompetitionMatch,
  EligibleWeeklyChallengePartner,
  WeeklyChallengeRequest
} from '@/domain/competition';
import type {
  CreateCreatorVideoSubmissionInput,
  CreatorVideoSubmission,
  CreatorWorkout,
  CreatorWorkoutPlan
} from '@/domain/creatorWorkouts';
import type { CategoryLeaderboard } from '@/domain/leaderboard';
import type {
  ClaimedReward,
  RewardAward,
  RewardCatalogItem,
  RewardWinner,
  SettledCompetitionSummary
} from '@/domain/rewards';
import type { StreakSummary } from '@/domain/streaks';
import type { ApiClient } from '@/services/api/client';

export type {
  CategoryLeaderboard,
  CategoryLeaderboardRow
} from '@/domain/leaderboard';

export type AppDataMode = 'api' | 'tour' | 'unavailable';

export type AppDataSource = {
  claimReward: (
    awardId: string,
    idempotencyKey: string
  ) => Promise<ClaimedReward>;
  getCategoryLeaderboard: (
    goal: GoalCategory
  ) => Promise<CategoryLeaderboard | null>;
  getCompetitionMatches: (
    competitionMonthKey: string,
    weeklyGoal: number,
    region: string
  ) => Promise<readonly CompetitionMatch[]>;
  getCompetitionEnrollmentCount: (
    region: string,
    competitionMonthKey: string
  ) => Promise<number | null>;
  getCreatorWorkouts: () => Promise<readonly CreatorWorkout[]>;
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
  if (mode === 'api') {
    return createApiDataSource(requireApi(api));
  }

  return createUnavailableDataSource();
}

function createApiDataSource(api: ApiClient): AppDataSource {
  return {
    claimReward: (awardId, idempotencyKey) => api.request<ClaimedReward>(
      `/v1/rewards/awards/${encodeURIComponent(awardId)}/claim`,
      { idempotencyKey, method: 'POST' }
    ),
    getCategoryLeaderboard: (goal) => api.request<CategoryLeaderboard>(
      `/v1/leaderboards/current?goal=${goal}`
    ),
    getCompetitionMatches: (competitionMonthKey, weeklyGoal, region) =>
      api.request<readonly CompetitionMatch[]>(
        `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
        `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}`
      ),
    getCompetitionEnrollmentCount: (region, competitionMonthKey) =>
      api.request<{ count: number }>(
        `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/enrollment-count` +
        `?region=${encodeURIComponent(region)}`,
        { authenticated: false }
      ).then(({ count }) => count),
    getCreatorWorkouts: () => api.request<readonly CreatorWorkout[]>(
      '/v1/creator-workouts'
    ),
    getCreatorWorkoutPlans: () => api.request<readonly CreatorWorkoutPlan[]>(
      '/v1/creator-workouts/plans/me'
    ),
    getEligibleWeeklyChallengePartners: (
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex
    ) => api.request<readonly EligibleWeeklyChallengePartner[]>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/eligible-partners` +
      `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}&period=${periodIndex}`
    ),
    getWeeklyChallengeRequests: (
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex
    ) => api.request<readonly WeeklyChallengeRequest[]>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests` +
      `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}&period=${periodIndex}`
    ),
    getMyRewardAwards: () => api.request<readonly RewardAward[]>(
      '/v1/rewards/awards/me'
    ),
    getMyStreaks: () => api.request<StreakSummary>('/v1/streaks/me'),
    getRewardCatalog: (region, monthKey) => {
      const query = new URLSearchParams({ region });
      if (monthKey) query.set('monthKey', monthKey);
      return api.request<readonly RewardCatalogItem[]>(
        `/v1/rewards/catalog?${query.toString()}`,
        { authenticated: false }
      );
    },
    getRewardWinners: () => api.request<readonly RewardWinner[]>(
      '/v1/results/reward-winners',
      { authenticated: false }
    ),
    getSettledCompetition: () =>
      api.request<SettledCompetitionSummary | null>(
        '/v1/results/settled-competition',
        { authenticated: false }
      ),
    planCreatorWorkout: (workoutId, plannedDate, note) =>
      api.request<CreatorWorkoutPlan, { note?: string; plannedDate: string }>(
        `/v1/creator-workouts/${encodeURIComponent(workoutId)}/plans`,
        {
          body: { note, plannedDate },
          idempotencyKey: createIdempotencyKey('creator-plan'),
          method: 'POST'
        }
      ),
    requestWeeklyChallengePartner: (
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex,
      recipientUserId
    ) => api.request<WeeklyChallengeRequest, {
      goal: number;
      period: number;
      recipientUserId: string;
      region: string;
    }>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests`,
      {
        body: {
          goal: weeklyGoal,
          period: periodIndex,
          recipientUserId,
          region
        },
        idempotencyKey: createIdempotencyKey('weekly-challenge'),
        method: 'POST'
      }
    ),
    respondToWeeklyChallengeRequest: (requestId, decision) =>
      api.request<WeeklyChallengeRequest, {
        decision: 'accepted' | 'declined';
      }>(
        `/v1/competitions/weekly-challenges/requests/${encodeURIComponent(requestId)}`,
        {
          body: { decision },
          idempotencyKey: createIdempotencyKey(
            'weekly-challenge-response'
          ),
          method: 'PATCH'
        }
      ),
    submitCreatorVideo: (input) => api.request<
      CreatorVideoSubmission,
      CreateCreatorVideoSubmissionInput
    >(
      '/v1/creator-workouts/submissions',
      {
        body: input,
        idempotencyKey: createIdempotencyKey('creator-submission'),
        method: 'POST'
      }
    ),
    mode: 'api'
  };
}

function createUnavailableDataSource(): AppDataSource {
  const unavailable = () => Promise.reject(
    new Error('The GoGymGo API is not configured.')
  );

  return {
    claimReward: unavailable,
    getCategoryLeaderboard: async () => null,
    getCompetitionMatches: async () => [],
    getCompetitionEnrollmentCount: async () => null,
    getCreatorWorkouts: async () => [],
    getCreatorWorkoutPlans: async () => [],
    getEligibleWeeklyChallengePartners: async () => [],
    getWeeklyChallengeRequests: async () => [],
    getMyRewardAwards: async () => [],
    getMyStreaks: async () => null,
    getRewardCatalog: async () => [],
    getRewardWinners: async () => [],
    getSettledCompetition: async () => null,
    planCreatorWorkout: unavailable,
    requestWeeklyChallengePartner: unavailable,
    respondToWeeklyChallengeRequest: unavailable,
    submitCreatorVideo: unavailable,
    mode: 'unavailable'
  };
}

let appDataIdempotencySequence = 0;

function createIdempotencyKey(scope: string) {
  appDataIdempotencySequence += 1;
  return `${scope}-${Date.now().toString(36)}-${appDataIdempotencySequence.toString(36)}`;
}

function requireApi(api: ApiClient | null): ApiClient {
  if (!api) throw new Error('GoGymGo API client is unavailable.');
  return api;
}
