import { BadRequestException } from '@nestjs/common';

export interface CompetitionPeriod {
  endDateKey: string;
  index: 1 | 2 | 3 | 4;
  startDateKey: string;
}

export function assertMonthKey(monthKey: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new BadRequestException({
      code: 'INVALID_COMPETITION_MONTH',
      message: 'Competition month keys must use YYYY-MM format.',
    });
  }
}

export function buildCompetitionPeriods(monthKey: string): CompetitionPeriod[] {
  assertMonthKey(monthKey);
  const [year, month] = monthKey.split('-').map(Number);

  return [0, 1, 2, 3].map((offset) => {
    const startDay = offset * 7 + 1;
    const endDay = startDay + 6;
    return {
      endDateKey: dateKey(year, month, endDay),
      index: (offset + 1) as 1 | 2 | 3 | 4,
      startDateKey: dateKey(year, month, startDay),
    };
  });
}

export function competitionMonthEndDateKey(monthKey: string): string {
  assertMonthKey(monthKey);
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return dateKey(year, month, lastDay);
}

export function dateKeyInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}
