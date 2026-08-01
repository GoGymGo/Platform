import {
  calculateFinalPrizeDrawWeight,
  calculateWeeklyMatchEntries,
  type PrizeDrawWeightSettings,
  type PrizeDrawWeightInput
} from '@/domain/campaignEconomics';
import { clampWeeklyGoal } from '@/domain/competition';
import { getCompetitionDateRange } from '@/domain/competitionEnrollment';

export type RemainderDayCount = 0 | 1 | 2 | 3;

export type RemainderDayOption = {
  label: string;
  value: RemainderDayCount;
};

export type MonthAwareCommitmentWeightInput = Omit<
  PrizeDrawWeightInput,
  'bonusDayEntries'
> & {
  remainderDayCount: number;
  weeklyGoal: number;
};

export function getCompetitionRemainderDayCount(
  competitionMonthKey: string
): RemainderDayCount {
  const { endDateKey } = getCompetitionDateRange(competitionMonthKey);
  const finalDay = Number(endDateKey.slice(-2));

  return Math.max(0, Math.min(3, finalDay - 28)) as RemainderDayCount;
}

export function buildRemainderDayOptions(
  competitionMonthKey: string
): readonly RemainderDayOption[] {
  const availableDays = getCompetitionRemainderDayCount(competitionMonthKey);

  return Array.from({ length: availableDays + 1 }, (_, value) => ({
    label: String(value),
    value: value as RemainderDayCount
  }));
}

export function calculateRemainderDayEntries(
  weeklyGoal: number,
  remainderDayCount: number,
  competitionMonthKey: string
) {
  const availableDays = getCompetitionRemainderDayCount(competitionMonthKey);
  const requestedDays = Number.isFinite(remainderDayCount)
    ? Math.max(0, Math.floor(remainderDayCount))
    : 0;
  const completedDays = Math.min(requestedDays, availableDays);

  return completedDays * clampWeeklyGoal(weeklyGoal);
}

export function calculateMonthAwareCommitmentWeight(
  input: MonthAwareCommitmentWeightInput,
  categoryRank: number | null,
  competitionMonthKey: string,
  settings: PrizeDrawWeightSettings
) {
  return calculateFinalPrizeDrawWeight(
    {
      bonusDayEntries: calculateRemainderDayEntries(
        input.weeklyGoal,
        input.remainderDayCount,
        competitionMonthKey
      ),
      perfectMonthMultiplier: input.perfectMonthMultiplier,
      periodEntriesBeforePerfectMonth: input.periodEntriesBeforePerfectMonth,
      signupEntries: input.signupEntries
    },
    categoryRank,
    settings
  );
}

export function calculateMaximumCommitmentEntries(
  weeklyGoal: number,
  competitionMonthKey: string,
  settings: PrizeDrawWeightSettings
) {
  const periodEntriesBeforePerfectMonth = calculateWeeklyMatchEntries(
    weeklyGoal,
    [3, 3, 3, 3]
  ).reduce((total, entries) => total + entries, 0);

  return calculateMonthAwareCommitmentWeight(
    {
      perfectMonthMultiplier: 10,
      periodEntriesBeforePerfectMonth,
      remainderDayCount: getCompetitionRemainderDayCount(competitionMonthKey),
      weeklyGoal,
      signupEntries: 0
    },
    1,
    competitionMonthKey,
    settings
  ).drawWeight;
}
