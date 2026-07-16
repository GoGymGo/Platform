import type { StreakSummary } from '@/domain/streaks';

const previewTimezone = 'America/Vancouver';

export function getStreakSummaryPreview(now = new Date()): StreakSummary {
  return {
    asOfDate: formatDateKey(now, previewTimezone),
    streaks: {
      daily: 3,
      monthly: 2,
      weekly: 4,
      yearly: 1
    },
    timezone: previewTimezone
  };
}

function formatDateKey(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
