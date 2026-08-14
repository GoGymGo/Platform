export type StreakCounts = {
  daily: number;
  monthly: number;
  projectionVersion: 'streaks-v1';
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
  projectionVersion: 'streaks-v1',
  weekly: 0,
  yearly: 0
};

export function isStreakCounts(value: unknown): value is StreakCounts {
  if (!isRecord(value) || value.projectionVersion !== 'streaks-v1') {
    return false;
  }
  return (['daily', 'monthly', 'weekly', 'yearly'] as const).every(
    (key) => typeof value[key] === 'number' && Number.isInteger(value[key]) && value[key] >= 0
  );
}

export function parseStreakSummary(value: unknown): StreakSummary | null {
  if (
    !isRecord(value) ||
    typeof value.asOfDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.asOfDate) ||
    typeof value.timezone !== 'string' ||
    value.timezone.length === 0 ||
    !isStreakCounts(value.streaks)
  ) {
    return null;
  }
  return {
    asOfDate: value.asOfDate,
    streaks: value.streaks,
    timezone: value.timezone
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
