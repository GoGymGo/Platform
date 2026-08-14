import { createHash } from 'node:crypto';

export interface WeeklyScoreInput {
  bothHitMultiplier: number;
  entriesPerVerifiedDay: number;
  goalDays: number;
  opponentVerifiedDays: number | null;
  recoveryMultiplier: number;
  verifiedDays: number;
}

export interface WeeklyScoreResult {
  entries: number;
  goalMet: boolean;
  multiplier: number;
  recovered: boolean;
}

export interface CategoryStandingInput {
  categoryScore: number;
  goalDays: number;
  longestStreak: number;
  userId: string;
  verifiedDays: number;
}

export interface CategoryStanding extends CategoryStandingInput {
  rank: number;
}

export function calculateWeeklyScore({
  bothHitMultiplier,
  entriesPerVerifiedDay,
  goalDays,
  opponentVerifiedDays,
  recoveryMultiplier,
  verifiedDays,
}: WeeklyScoreInput): WeeklyScoreResult {
  const goalMet = verifiedDays >= goalDays;
  if (!goalMet) {
    return { entries: 0, goalMet: false, multiplier: 0, recovered: false };
  }

  const opponentMet =
    opponentVerifiedDays !== null && opponentVerifiedDays >= goalDays;
  const recovered =
    opponentVerifiedDays !== null && !opponentMet && verifiedDays > goalDays;
  const multiplier = opponentMet
    ? bothHitMultiplier
    : recovered
      ? recoveryMultiplier
      : 1;

  return {
    entries: goalDays * entriesPerVerifiedDay * multiplier,
    goalMet,
    multiplier,
    recovered,
  };
}

export function rankCategoryStandings(
  competitionId: string,
  rulesVersion: string,
  standings: readonly CategoryStandingInput[],
): CategoryStanding[] {
  return [...standings]
    .sort(
      (left, right) =>
        right.categoryScore - left.categoryScore ||
        right.longestStreak - left.longestStreak ||
        right.verifiedDays - left.verifiedDays ||
        competitionTieBreakDigest(
          competitionId,
          rulesVersion,
          left.userId,
        ).localeCompare(
          competitionTieBreakDigest(competitionId, rulesVersion, right.userId),
        ),
    )
    .map((standing, index) => ({ ...standing, rank: index + 1 }));
}

export function applyCategoryMultiplier(
  entries: number,
  multiplier: number,
): number {
  return Math.floor(Math.max(0, entries) * Math.max(1, multiplier));
}

export function longestConsecutiveDateStreak(
  dateKeys: readonly string[],
): number {
  const uniqueDays = [...new Set(dateKeys)].sort();
  let longest = 0;
  let current = 0;
  let previousDay: number | null = null;

  for (const dateKey of uniqueDays) {
    const day = Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000;
    current = previousDay !== null && day === previousDay + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousDay = day;
  }

  return longest;
}

export function competitionTieBreakDigest(
  competitionId: string,
  rulesVersion: string,
  userId: string,
): string {
  return createHash('sha256')
    .update(`${competitionId}:${rulesVersion}:${userId}`)
    .digest('hex');
}
