export type StreakCounts = {
  daily: number;
  monthly: number;
  weekly: number;
  yearly: number;
};

export type StreakSummary = {
  asOfDate: string;
  streaks: StreakCounts;
  timezone: string;
};

export const emptyStreakCounts: StreakCounts = {
  daily: 0,
  monthly: 0,
  weekly: 0,
  yearly: 0
};
