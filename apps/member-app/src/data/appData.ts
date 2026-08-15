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
import { normalizeParticipantCompetitionResults } from '@/data/participantCompetitionResults';

export type {
  CategoryLeaderboard,
  CategoryLeaderboardRow
} from '@/domain/leaderboard';

export type AppDataMode = 'api' | 'tour' | 'unavailable';

export type AppDataSource = {
  claimReward: (awardId: string) => Promise<ClaimedReward>;
  getCategoryLeaderboard: (
    goal: GoalCategory
  ) => Promise<CategoryLeaderboard | null>;
  getCompetitionMatches: (
    competitionMonthKey: string,
    weeklyGoal: number,
    regionCode: string,
    competitionId: string
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
    competitionId: string,
    competitionMonthKey: string,
    weeklyGoal: number,
    regionCode: string,
    periodIndex: number
  ) => Promise<readonly EligibleWeeklyChallengePartner[]>;
  getWeeklyChallengeRequests: (
    competitionId: string,
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
    competitionId: string,
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
  cancelWeeklyChallengeRequest: (
    requestId: string
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
  const retryIdempotencyKeys = new Map<string, string>();
  const runRetryableMutation = <Result>(
    operationKey: string,
    action: (idempotencyKey: string) => Promise<Result>
  ) => {
    const idempotencyKey = retryIdempotencyKeys.get(operationKey) ??
      createIdempotencyKey(operationKey);
    retryIdempotencyKeys.set(operationKey, idempotencyKey);
    return action(idempotencyKey).then((result) => {
      retryIdempotencyKeys.delete(operationKey);
      return result;
    });
  };

  return {
    claimReward: (awardId) => runRetryableMutation(
      `reward-claim:${awardId}`,
      (idempotencyKey) => api.request<unknown>(
        `/v1/rewards/awards/${encodeURIComponent(awardId)}/claim`,
        { idempotencyKey, method: 'POST' }
      ).then(normalizeClaimedReward)
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
      api.request<unknown>(
        `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
          `?goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}` +
          `&competitionId=${encodeURIComponent(competitionId)}`
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
      competitionId,
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ) => api.request<unknown>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/eligible-partners` +
      `?competitionId=${encodeURIComponent(competitionId)}` +
      `&goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}&period=${periodIndex}`
    ).then(normalizeEligibleWeeklyChallengePartners),
    getWeeklyChallengeRequests: (
      competitionId,
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ) => api.request<unknown>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests` +
      `?competitionId=${encodeURIComponent(competitionId)}` +
      `&goal=${weeklyGoal}&region=${encodeURIComponent(regionCode)}&period=${periodIndex}`
    ).then(normalizeWeeklyChallengeRequests),
    getMyRewardAwards: () => api.request<unknown>(
      '/v1/rewards/awards/me'
    ).then(normalizeRewardAwards),
    getMyLatestCompetitionResults: () =>
      api.request<unknown>(
        '/v1/results/mine/latest'
      ).then(normalizeParticipantCompetitionResults),
    getMyStreaks: () =>
      api.request<unknown>('/v1/streaks/me').then(parseStreakSummary),
    getRewardCatalog: (regionCode, monthKey) => {
      const query = new URLSearchParams({ region: regionCode });
      if (monthKey) query.set('monthKey', monthKey);
      return api.request<unknown>(
        `/v1/rewards/catalog?${query.toString()}`,
        { authenticated: false }
      ).then(normalizeRewardCatalog);
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
      competitionId,
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex,
      recipientUserId
    ) => runRetryableMutation(
      `weekly-challenge-request:${competitionId}:${periodIndex}:${recipientUserId}`,
      (idempotencyKey) => api.request<unknown, {
      competitionId: string;
      goal: number;
      period: number;
      recipientUserId: string;
      region: string;
    }>(
      `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/weekly-challenges/requests`,
      {
        body: {
          competitionId,
          goal: weeklyGoal,
          period: periodIndex,
          recipientUserId,
          region: regionCode
        },
        idempotencyKey,
        method: 'POST'
      }
    ).then(normalizeWeeklyChallengeRequest)),
    respondToWeeklyChallengeRequest: (requestId, decision) =>
      runRetryableMutation(
        `weekly-challenge-response:${requestId}:${decision}`,
        (idempotencyKey) => api.request<unknown, {
        decision: 'accepted' | 'declined';
      }>(
        `/v1/competitions/weekly-challenges/requests/${encodeURIComponent(requestId)}`,
        {
          body: { decision },
          idempotencyKey,
          method: 'PATCH'
        }
      ).then(normalizeWeeklyChallengeRequest)),
    cancelWeeklyChallengeRequest: (requestId) => runRetryableMutation(
      `weekly-challenge-cancel:${requestId}`,
      (idempotencyKey) => api.request<unknown>(
        `/v1/competitions/weekly-challenges/requests/${encodeURIComponent(requestId)}`,
        { idempotencyKey, method: 'DELETE' }
      ).then(normalizeWeeklyChallengeRequest)
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

function normalizeRewardCatalog(response: unknown): readonly RewardCatalogItem[] {
  if (!Array.isArray(response) || !response.every(isRewardCatalogItem)) {
    throw new Error('The reward catalog response is invalid.');
  }
  return response;
}

function normalizeRewardAwards(response: unknown): readonly RewardAward[] {
  if (!Array.isArray(response) || !response.every(isRewardAward)) {
    throw new Error('The reward award response is invalid.');
  }
  return response;
}

function normalizeClaimedReward(response: unknown): ClaimedReward {
  if (!isClaimedReward(response)) {
    throw new Error('The reward claim response is invalid.');
  }
  return response;
}

function isRewardCatalogItem(value: unknown): value is RewardCatalogItem {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "availableFrom",
      "availableUntil",
      "cashAmountCents",
      "cashCurrency",
      "competitionId",
      "competitionName",
      "description",
      "id",
      "imageUrl",
      "inventoryRemaining",
      "inventoryTotal",
      "monthKey",
      "regionCode",
      "regionName",
      "regionTimezone",
      "rewardType",
      "sponsorName",
      "termsUrl",
      "title",
    ]) &&
    isNullableIsoDate(value.availableFrom) &&
    isNullableIsoDate(value.availableUntil) &&
    isRewardCashValue(
      value.rewardType,
      value.cashAmountCents,
      value.cashCurrency,
    ) &&
    typeof value.competitionId === "string" &&
    isUuid(value.competitionId) &&
    typeof value.competitionName === 'string' &&
    typeof value.description === 'string' &&
    typeof value.id === 'string' &&
    isUuid(value.id) &&
    isHttpsUrl(value.imageUrl) &&
    isFiniteNonnegativeInteger(value.inventoryRemaining) &&
    isIntegerInRange(value.inventoryTotal, 1, 100_000) &&
    value.inventoryRemaining <= value.inventoryTotal &&
    typeof value.monthKey === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value.monthKey) &&
    typeof value.regionCode === 'string' &&
    typeof value.regionName === 'string' &&
    typeof value.regionTimezone === 'string' &&
    value.regionTimezone.length > 0 &&
    isRewardType(value.rewardType) &&
    typeof value.sponsorName === 'string' &&
    isHttpsUrl(value.termsUrl) &&
    typeof value.title === 'string'
  );
}

function isRewardAward(value: unknown): value is RewardAward {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "awardRank",
      "awardedAt",
      "cashAmountCents",
      "cashCurrency",
      "claimedAt",
      "fulfilledAt",
      "id",
      "imageUrl",
      "rewardType",
      "sponsorName",
      "status",
      "title",
    ]) &&
    isIntegerInRange(value.awardRank, 1, 100_000) &&
    isIsoDate(value.awardedAt) &&
    isRewardCashValue(
      value.rewardType,
      value.cashAmountCents,
      value.cashCurrency,
    ) &&
    isNullableIsoDate(value.claimedAt) &&
    isNullableIsoDate(value.fulfilledAt) &&
    isUuid(value.id) &&
    isNullableHttpsUrl(value.imageUrl) &&
    isRewardType(value.rewardType) &&
    typeof value.sponsorName === 'string' &&
    isRewardAwardStatus(value.status) &&
    typeof value.title === "string" &&
    (value.status === "fulfilled"
      ? value.fulfilledAt !== null
      : value.fulfilledAt === null) &&
    (value.status === "awarded" || value.status === "cancelled"
      ? value.claimedAt === null
      : value.claimedAt !== null)
  );
}

function isClaimedReward(value: unknown): value is ClaimedReward {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "awardRank",
      "awardedAt",
      "cashAmountCents",
      "cashCurrency",
      "claimUrl",
      "claimedAt",
      "couponCode",
      "fulfilledAt",
      "fulfillmentInstructions",
      "id",
      "imageUrl",
      "rewardType",
      "sponsorName",
      "status",
      "title",
    ]) ||
    !isIntegerInRange(value.awardRank, 1, 100_000) ||
    !isIsoDate(value.awardedAt) ||
    !isRewardCashValue(
      value.rewardType,
      value.cashAmountCents,
      value.cashCurrency,
    ) ||
    !isIsoDate(value.claimedAt) ||
    !isNullableIsoDate(value.fulfilledAt) ||
    !isUuid(value.id) ||
    !isNullableHttpsUrl(value.imageUrl) ||
    !isRewardType(value.rewardType) ||
    typeof value.sponsorName !== 'string' ||
    !['claimed', 'fulfilled', 'redeemed'].includes(String(value.status)) ||
    typeof value.title !== 'string'
  ) {
    return false;
  }

  if (value.rewardType === 'coupon') {
    return (
      typeof value.couponCode === 'string' &&
      value.couponCode.length > 0 &&
      value.claimUrl === null &&
      value.fulfillmentInstructions === null
    );
  }
  if (value.rewardType === 'physical') {
    const hasUrl = isHttpsUrl(value.claimUrl);
    const hasInstructions =
      typeof value.fulfillmentInstructions === 'string' &&
      value.fulfillmentInstructions.trim().length > 0;
    return value.couponCode === null && hasUrl !== hasInstructions;
  }
  return false;
}

function isRewardType(value: unknown): value is RewardCatalogItem['rewardType'] {
  return value === 'cash' || value === 'coupon' || value === 'physical';
}

function isRewardCashValue(
  rewardType: unknown,
  amountCents: unknown,
  currency: unknown,
): boolean {
  return rewardType === "cash"
    ? isIntegerInRange(amountCents, 1, 10_000_000) &&
        typeof currency === "string" &&
        /^[A-Z]{3}$/.test(currency)
    : amountCents === null && currency === null;
}

function isRewardAwardStatus(value: unknown): value is RewardAward["status"] {
  return (
    value === 'awarded' ||
    value === 'cancelled' ||
    value === 'claimed' ||
    value === 'fulfilled' ||
    value === 'redeemed'
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isNullableHttpsUrl(value: unknown): value is string | null {
  return value === null || isHttpsUrl(value);
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
  if (!Array.isArray(response) || !response.every(isCompetitionMatch)) {
    throw new Error('The Weekly Challenge match response is invalid.');
  }
  return response;
}

function normalizeEligibleWeeklyChallengePartners(
  response: unknown
): readonly EligibleWeeklyChallengePartner[] {
  if (!Array.isArray(response) || !response.every(isEligibleWeeklyChallengePartner)) {
    throw new Error('The Weekly Challenge partner response is invalid.');
  }
  return response;
}

function normalizeWeeklyChallengeRequests(
  response: unknown
): readonly WeeklyChallengeRequest[] {
  if (!Array.isArray(response) || !response.every(isWeeklyChallengeRequest)) {
    throw new Error('The Weekly Challenge request response is invalid.');
  }
  return response;
}

function normalizeWeeklyChallengeRequest(response: unknown): WeeklyChallengeRequest {
  if (!isWeeklyChallengeRequest(response)) {
    throw new Error('The Weekly Challenge request response is invalid.');
  }
  return response;
}

function isCompetitionMatch(value: unknown): value is CompetitionMatch {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'availability',
      'entries',
      'multiplier',
      'opponentAlias',
      'opponentBestStreak',
      'opponentCurrentStreak',
      'opponentMonthlyVerifiedDays',
      'opponentStreaks',
      'opponentVerifiedCount',
      'periodIndex',
      'region',
      'scoringStatus'
    ]) &&
    (value.availability === 'matched' ||
      value.availability === 'searching' ||
      value.availability === 'solo') &&
    isFiniteNonnegativeInteger(value.entries) &&
    isWeeklyMultiplier(value.multiplier) &&
    (value.opponentAlias === null || typeof value.opponentAlias === 'string') &&
    isFiniteNonnegativeInteger(value.opponentBestStreak) &&
    isFiniteNonnegativeInteger(value.opponentCurrentStreak) &&
    isFiniteNonnegativeInteger(value.opponentMonthlyVerifiedDays) &&
    isStreakCounts(value.opponentStreaks) &&
    isIntegerInRange(value.opponentVerifiedCount, 0, 7) &&
    isIntegerInRange(value.periodIndex, 1, 4) &&
    typeof value.region === 'string' &&
    (value.scoringStatus === 'projected' || value.scoringStatus === 'settled')
  );
}

function isEligibleWeeklyChallengePartner(
  value: unknown
): value is EligibleWeeklyChallengePartner {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'alias',
      'goalDays',
      'requestStatus',
      'streaks',
      'userId'
    ]) &&
    typeof value.alias === 'string' &&
    isIntegerInRange(value.goalDays, 1, 7) &&
    (value.requestStatus === 'available' || value.requestStatus === 'pending') &&
    isStreakCounts(value.streaks) &&
    typeof value.userId === 'string'
  );
}

function isWeeklyChallengeRequest(value: unknown): value is WeeklyChallengeRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'createdAt',
      'direction',
      'goalDays',
      'id',
      'partnerAlias',
      'partnerStreaks',
      'periodIndex',
      'status'
    ]) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    (value.direction === 'incoming' || value.direction === 'outgoing') &&
    isIntegerInRange(value.goalDays, 1, 7) &&
    typeof value.id === 'string' &&
    typeof value.partnerAlias === 'string' &&
    isStreakCounts(value.partnerStreaks) &&
    isIntegerInRange(value.periodIndex, 1, 4) &&
    (value.status === 'accepted' ||
      value.status === 'cancelled' ||
      value.status === 'declined' ||
      value.status === 'pending')
  );
}

function isWeeklyMultiplier(value: unknown): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isFiniteNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
) {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  return actual.length === expected.size && actual.every((key) => expected.has(key));
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
    cancelWeeklyChallengeRequest: unavailable,
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
