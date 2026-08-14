import type { GoalCategory } from '@/domain/campaignEconomics';
import type { StreakCounts } from '@/domain/streaks';

export type CategoryLeaderboardRow = {
  alias: string;
  categoryEntries: number;
  isCurrentUser: boolean;
  rank: number;
  streaks: StreakCounts;
  verifiedDays: number;
};

export type CategoryLeaderboard = {
  competitionId: string;
  goal: GoalCategory;
  rows: readonly CategoryLeaderboardRow[];
  rulesVersion: string;
  scoringStatus: 'final' | 'provisional';
  serverTime: string;
  settledPeriodCount: number;
};
