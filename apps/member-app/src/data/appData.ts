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
  ParticipantCompetitionResults,
  RewardAward,
  RewardCatalogItem
} from '@/domain/rewards';
import { isStreakCounts, parseStreakSummary, type StreakSummary } from '@/domain/streaks';
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
    regionCode: string,
    competitionId?: string | null
  ) => Promise<readonly CompetitionMatch[]>;
  getCompetitionEnrollmentCount: (
    competitionId: string,
    regionCode: string,
    competitionMonthKey: string
  ) => Promise<number | null>;
  getCreatorWorkouts: (
    regionCode: string
  ) => Promise<readonly CreatorWorkout[]>;
  getCreatorWorkoutPlans: () => Promise<readonly CreatorWorkoutPlan[]>;
  getEligibleWeeklyChallengePartners: (
    competitionMonthKey: string,
    weeklyGoal: number,
    regionCode: string,
    periodIndex: number
  ) => Promise<readonly EligibleWeeklyChallengePartner[]>;
  getWeeklyChallengeRequests: (
    competitionMonthKey: string,
    weeklyGoal: number,
    regionCode: string,
    periodIndex: number
  ) => Promise<readonly WeeklyChallengeRequest[]>;
  getMyRewardAwards: () => Promise<readonly RewardAward[]>;
  getMyLatestCompetitionResults: () => Promise<ParticipantCompetitionResults | null>;
  getMyStreaks: () => Promise<StreakSummary | null>;
  getRewardCatalog: (
    regionCode: string,
    monthKey?: string
  ) => Promise<readonly RewardCatalogItem[]>;
  planCreatorWorkout: (
    workoutId: string,
    plannedDate: string,
    note?: string
  ) => Promise<CreatorWorkoutPlan>;
  requestWeeklyChallengePartner: (
    competitionMonthKey: string,
    weeklyGoal: number,
    regionCode: string,
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
    getCategoryLeaderboard: (goal) => api.request<unknown>(
      `/v1/leaderboards/current?goal=${goal}`
    ).then((response) => normalizeCategoryLeaderboard(response, goal)),
    getCompetitionMatches: (
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      competitionId
    ) =>
      (competitionId
        ? api.request<unknown>(
            `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
              `?goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}` +
              `&competitionId=${encodeURIComponent(competitionId)}`
          )
        : api.request<unknown>(
            `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
              `?goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}`
          )
      ).then(normalizeCompetitionMatches),
    getCompetitionEnrollmentCount: (
      competitionId,
      regionCode,
      competitionMonthKey
    ) =>
      api.request<{ count: number }>(
        `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/enrollment-count` +
        `?competitionId=${encodeURIComponent(competitionId)}` +
        `&region=${encodeURIComponent(regionCode)}`,
        { authenticated: false }
      ).then(({ count }) => count),
    getCreatorWorkouts: (regionCode) => api.request<readonly CreatorWorkout[]>(
      `/v1/creator-workouts?region=${encodeURIComponent(regionCode)}`
    ),
    getCreatorWorkoutPlans: () => api.request<readonly CreatorWorkoutPlan[]>(
      '/v1/creator-workouts/plans/me'
    ),
    getEligibleWeeklyChallengePartners: (
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ) => api.request<readonly EligibleWeeklyChallengePartner[]>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/eligible-partners` +
      `?goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}&period=${periodIndex}`
    ),
    getWeeklyChallengeRequests: (
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ) => api.request<readonly WeeklyChallengeRequest[]>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests` +
      `?goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}&period=${periodIndex}`
    ),
    getMyRewardAwards: () => api.request<readonly RewardAward[]>(
      '/v1/rewards/awards/me'
    ),
    getMyLatestCompetitionResults: () =>
      api.request<ParticipantCompetitionResults | null>(
        '/v1/results/mine/latest'
      ),
    getMyStreaks: () =>
      api.request<unknown>('/v1/streaks/me').then(parseStreakSummary),
    getRewardCatalog: (regionCode, monthKey) => {
      const query = new URLSearchParams({ region: regionCode });
      if (monthKey) query.set('monthKey', monthKey);
      return api.request<readonly RewardCatalogItem[]>(
        `/v1/rewards/catalog?${query.toString()}`,
        { authenticated: false }
      );
    },
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
      regionCode,
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
          region: regionCode
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

function normalizeCategoryLeaderboard(
  response: unknown,
  requestedGoal: GoalCategory
): CategoryLeaderboard | null {
  if (
    !isRecord(response) ||
    response.goal !== requestedGoal ||
    typeof response.competitionId !== 'string' ||
    typeof response.rulesVersion !== 'string' ||
    typeof response.serverTime !== 'string' ||
    !isScoringStatus(response.scoringStatus) ||
    !isIntegerInRange(response.settledPeriodCount, 0, 4) ||
    !Array.isArray(response.rows) ||
    !response.rows.every(isCategoryLeaderboardRow)
  ) {
    return null;
  }

  return {
    competitionId: response.competitionId,
    goal: requestedGoal,
    rows: response.rows,
    rulesVersion: response.rulesVersion,
    scoringStatus: response.scoringStatus,
    serverTime: response.serverTime,
    settledPeriodCount: response.settledPeriodCount
  };
}

function normalizeCompetitionMatches(response: unknown): readonly CompetitionMatch[] {
  if (!Array.isArray(response)) {
    return [];
  }
  return response.filter(
    (match): match is CompetitionMatch =>
      isRecord(match) && isStreakCounts(match.opponentStreaks)
  );
}

function isCategoryLeaderboardRow(
  value: unknown
): value is CategoryLeaderboard['rows'][number] {
  return (
    isRecord(value) &&
    typeof value.alias === 'string' &&
    isFiniteNumber(value.categoryEntries) &&
    typeof value.isCurrentUser === 'boolean' &&
    isFiniteNumber(value.rank) &&
    isRecord(value.streaks) &&
    isFiniteNumber(value.streaks.daily) &&
    isFiniteNumber(value.streaks.monthly) &&
    value.streaks.projectionVersion === 'streaks-v1' &&
    isFiniteNumber(value.streaks.weekly) &&
    isFiniteNumber(value.streaks.yearly) &&
    isFiniteNumber(value.verifiedDays)
  );
}

function isScoringStatus(value: unknown): value is 'final' | 'provisional' {
  return value === 'final' || value === 'provisional';
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
    getMyLatestCompetitionResults: async () => null,
    getMyStreaks: async () => null,
    getRewardCatalog: async () => [],
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
