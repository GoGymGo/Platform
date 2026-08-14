import type { StreakCounts } from '@/domain/streaks';

export type StreakBadgeKey = Exclude<keyof StreakCounts, 'projectionVersion'>;

const durationUnits: readonly { days: number; key: StreakBadgeKey }[] = [
  { days: 365, key: 'yearly' },
  { days: 30, key: 'monthly' },
  { days: 7, key: 'weekly' },
  { days: 1, key: 'daily' }
] as const;

export function getVisibleStreakUnits(streaks: StreakCounts, maximum = 2) {
  const limit = Math.max(1, Math.min(2, maximum));
  let remainingDays = Math.max(0, Math.floor(streaks.daily));
  const visible: { count: number; key: StreakBadgeKey }[] = [];

  for (const unit of durationUnits) {
    const count = Math.floor(remainingDays / unit.days);
    if (count > 0) {
      visible.push({ count, key: unit.key });
      remainingDays %= unit.days;
    }
    if (visible.length === limit) {
      break;
    }
  }

  if (visible.length === 0) {
    const fallback = (['yearly', 'monthly', 'weekly'] as const).find(
      (key) => streaks[key] > 0
    );
    if (fallback) {
      visible.push({ count: streaks[fallback], key: fallback });
    }
  }

  return visible;
}
