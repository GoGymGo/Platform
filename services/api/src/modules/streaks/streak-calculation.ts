import { normalizeDateKey } from '../../database/date-key';

export interface StreakCounts {
  daily: number;
  monthly: number;
  projectionVersion: typeof STREAK_PROJECTION_VERSION;
  weekly: number;
  yearly: number;
}

export const STREAK_PROJECTION_VERSION = 'streaks-v1' as const;

type PeriodIndexFactory = (date: Date) => number;

const MILLISECONDS_PER_DAY = 86_400_000;
const MONDAY_EPOCH_DAY = 4;

export function calculateStreaks(
  verifiedDateKeys: readonly string[],
  asOfDateKey: string,
): StreakCounts {
  const asOfDate = parseDateKey(asOfDateKey);
  const verifiedDates = verifiedDateKeys
    .map(parseDateKey)
    .filter((date) => date <= asOfDate);

  return {
    daily: calculateConsecutivePeriods(verifiedDates, asOfDate, dayIndex),
    weekly: calculateConsecutivePeriods(
      verifiedDates,
      asOfDate,
      mondayWeekIndex,
    ),
    monthly: calculateConsecutivePeriods(verifiedDates, asOfDate, monthIndex),
    projectionVersion: STREAK_PROJECTION_VERSION,
    yearly: calculateConsecutivePeriods(verifiedDates, asOfDate, yearIndex),
  };
}

function calculateConsecutivePeriods(
  verifiedDates: readonly Date[],
  asOfDate: Date,
  periodIndex: PeriodIndexFactory,
): number {
  const periods = new Set(verifiedDates.map(periodIndex));
  if (periods.size === 0) {
    return 0;
  }

  const currentPeriod = periodIndex(asOfDate);
  const latestPeriod = Math.max(...periods);
  if (latestPeriod !== currentPeriod && latestPeriod !== currentPeriod - 1) {
    return 0;
  }

  let count = 0;
  let candidate = latestPeriod;
  while (periods.has(candidate)) {
    count += 1;
    candidate -= 1;
  }
  return count;
}

function parseDateKey(value: string): Date {
  const normalized = normalizeDateKey(value);
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Unexpected database date key.');
  }
  return parsed;
}

function dayIndex(date: Date): number {
  return Math.floor(date.getTime() / MILLISECONDS_PER_DAY);
}

function mondayWeekIndex(date: Date): number {
  return Math.floor((dayIndex(date) - MONDAY_EPOCH_DAY) / 7);
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function yearIndex(date: Date): number {
  return date.getUTCFullYear();
}
