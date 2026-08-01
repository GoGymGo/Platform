import type { GoalCategory } from '@/domain/campaignEconomics';
import type { StreakCounts } from '@/domain/streaks';

export type CategoryLeaderboardRow = {
  alias: string;
  categoryEntries: number;
  rank: number;
  streaks: StreakCounts;
  verifiedDays: number;
};

export type CategoryLeaderboard = {
  goal: GoalCategory;
  rows: readonly CategoryLeaderboardRow[];
};
