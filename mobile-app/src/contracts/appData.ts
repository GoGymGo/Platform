import type { GoalCategory } from '@/domain/campaignEconomics';

export type CategoryLeaderboardRow = {
  alias: string;
  categoryEntries: number;
  rank: number;
  verifiedDays: number;
};

export type CategoryLeaderboard = {
  goal: GoalCategory;
  rows: readonly CategoryLeaderboardRow[];
};

export type CreatorWorkout = {
  creatorName: string;
  durationMinutes: number;
  id: string;
  joined: boolean;
  name: string;
  regionCodes: readonly string[];
  reward: string;
  sponsorName: string | null;
  thumbnailUrl: string | null;
  timing: string;
  videoUrl: string;
  workoutStyle: string;
};

export type PayoutWinner = {
  alias: string;
  amount: number;
  payoutRank: number;
};

export type SettledCompetitionSummary = {
  payoutExponent: number;
  payoutPoolAmount: number;
  payoutWinnerCount: number;
};
