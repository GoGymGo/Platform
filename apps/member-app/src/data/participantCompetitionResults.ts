import type { GoalCategory } from '@/domain/campaignEconomics';
import type { CategoryLeaderboard } from '@/domain/leaderboard';
import type { ParticipantCompetitionResults } from '@/domain/rewards';
import { isStreakCounts } from '@/domain/streaks';

export function normalizeParticipantCompetitionResults(
  response: unknown
): ParticipantCompetitionResults | null {
  if (response === null) return null;
  if (
    !isRecord(response) ||
    !hasExactKeys(response, [
      'categoryLeaderboards',
      'competitionId',
      'competitionName',
      'endedAt',
      'monthKey',
      'participantGoalDays',
      'regionCode',
      'regionName',
      'resultsStatus',
      'rewardCount',
      'rewardWinners',
      'settledAt'
    ]) ||
    !isUuid(response.competitionId) ||
    typeof response.competitionName !== 'string' ||
    response.competitionName.trim().length === 0 ||
    !isIsoDate(response.endedAt) ||
    typeof response.monthKey !== 'string' ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(response.monthKey) ||
    !isIntegerInRange(response.participantGoalDays, 1, 7) ||
    typeof response.regionCode !== 'string' ||
    response.regionCode.trim().length === 0 ||
    typeof response.regionName !== 'string' ||
    response.regionName.trim().length === 0 ||
    !isFiniteNonnegativeInteger(response.rewardCount) ||
    !Array.isArray(response.categoryLeaderboards) ||
    !Array.isArray(response.rewardWinners)
  ) {
    throw new Error('The Winners Circle response is invalid.');
  }

  const competitionId = response.competitionId;
  const participantGoalDays = response.participantGoalDays as GoalCategory;
  if (response.resultsStatus === 'pending') {
    if (
      response.settledAt !== null ||
      response.rewardCount !== 0 ||
      response.categoryLeaderboards.length !== 0 ||
      response.rewardWinners.length !== 0
    ) {
      throw new Error('The pending Winners Circle response is inconsistent.');
    }
    return response as ParticipantCompetitionResults;
  }
  if (
    response.resultsStatus !== 'settled' ||
    !isIsoDate(response.settledAt) ||
    Date.parse(response.settledAt) < Date.parse(response.endedAt) ||
    response.categoryLeaderboards.length === 0 ||
    response.rewardWinners.length === 0 ||
    response.rewardCount !== response.rewardWinners.length ||
    !response.rewardWinners.every(isRewardWinner) ||
    !response.rewardWinners.every(
      (winner, index) => winner.awardRank === index + 1
    ) ||
    !response.categoryLeaderboards.every((leaderboard) =>
      isSettledCategoryLeaderboard(leaderboard, competitionId)
    )
  ) {
    throw new Error('The settled Winners Circle response is invalid.');
  }
  const goals = response.categoryLeaderboards.map(({ goal }) => goal);
  if (
    new Set(goals).size !== goals.length ||
    !goals.includes(participantGoalDays)
  ) {
    throw new Error('The settled Winners Circle categories are inconsistent.');
  }
  if (
    response.monthKey === "2026-09" &&
    response.competitionName === "GoGymGo September 2026 Island Pilot" &&
    response.regionCode === "vancouver-island-gulf-islands-bc"
  ) {
    const winner = response.rewardWinners[0];
    if (
      response.rewardCount !== 1 ||
      !winner ||
      winner.awardRank !== 1 ||
      winner.rewardType !== "cash" ||
      winner.sponsorName !== "GoGymGo" ||
      winner.rewardTitle !== "GoGymGo $100 CAD Cash Reward" ||
      winner.cashAmountCents !== 10000 ||
      winner.cashCurrency !== "CAD"
    ) {
      throw new Error("The September pilot reward snapshot is inconsistent.");
    }
  }
  return response as ParticipantCompetitionResults;
}

function isRewardWinner(
  value: unknown
): value is ParticipantCompetitionResults['rewardWinners'][number] {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "alias",
      "awardRank",
      "cashAmountCents",
      "cashCurrency",
      "prizeDrawEntries",
      "rewardTitle",
      "rewardType",
      "sponsorName",
      "streaks",
    ]) &&
    typeof value.alias === 'string' &&
    value.alias.trim().length > 0 &&
    isIntegerInRange(value.awardRank, 1, 100_000) &&
    isIntegerInRange(value.prizeDrawEntries, 1, Number.MAX_SAFE_INTEGER) &&
    (value.rewardType === "cash"
      ? isIntegerInRange(value.cashAmountCents, 1, 10_000_000) &&
        typeof value.cashCurrency === "string" &&
        /^[A-Z]{3}$/.test(value.cashCurrency)
      : value.cashAmountCents === null && value.cashCurrency === null) &&
    typeof value.rewardTitle === "string" &&
    value.rewardTitle.trim().length > 0 &&
    (value.rewardType === 'cash' ||
      value.rewardType === 'coupon' ||
      value.rewardType === 'physical') &&
    typeof value.sponsorName === 'string' &&
    value.sponsorName.trim().length > 0 &&
    isStreakCounts(value.streaks)
  );
}

function isSettledCategoryLeaderboard(
  value: unknown,
  competitionId: string
): value is CategoryLeaderboard {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'competitionId',
      'goal',
      'rows',
      'rulesVersion',
      'scoringStatus',
      'serverTime',
      'settledPeriodCount'
    ]) &&
    value.competitionId === competitionId &&
    isIntegerInRange(value.goal, 1, 7) &&
    typeof value.rulesVersion === 'string' &&
    value.rulesVersion.trim().length > 0 &&
    value.scoringStatus === 'final' &&
    isIsoDate(value.serverTime) &&
    value.settledPeriodCount === 4 &&
    Array.isArray(value.rows) &&
    value.rows.length > 0 &&
    value.rows.every(isExactCategoryLeaderboardRow) &&
    value.rows.every((row, index) => row.rank === index + 1)
  );
}

function isExactCategoryLeaderboardRow(
  value: unknown
): value is CategoryLeaderboard['rows'][number] {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'alias',
      'categoryEntries',
      'isCurrentUser',
      'rank',
      'streaks',
      'verifiedDays'
    ]) &&
    typeof value.alias === 'string' &&
    value.alias.trim().length > 0 &&
    isFiniteNumber(value.categoryEntries) &&
    value.categoryEntries >= 0 &&
    typeof value.isCurrentUser === 'boolean' &&
    isIntegerInRange(value.rank, 1, 100_000) &&
    isStreakCounts(value.streaks) &&
    isIntegerInRange(value.verifiedDays, 0, 31)
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  return actual.length === expected.size && actual.every((key) => expected.has(key));
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

function isFiniteNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
