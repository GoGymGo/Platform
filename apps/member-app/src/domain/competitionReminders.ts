import { buildCompetitionCalendar } from './competition';

export type CompetitionReminder = {
  body: string;
  dateKey: string;
  kind: 'period-progress' | 'bonus-day';
  title: string;
};

type BuildCompetitionRemindersInput = {
  competitionMonthKey: string;
  referenceDateKey: string;
  userVerifiedDateKeys: readonly string[];
  weeklyGoal: number;
};

export function buildCompetitionReminders({
  competitionMonthKey,
  referenceDateKey,
  userVerifiedDateKeys,
  weeklyGoal
}: BuildCompetitionRemindersInput): readonly CompetitionReminder[] {
  const calendar = buildCompetitionCalendar(competitionMonthKey);
  const verifiedDates = new Set(userVerifiedDateKeys);
  const reminders: CompetitionReminder[] = [];

  for (const period of calendar.periods) {
    const verifiedCount = period.dateKeys.filter((dateKey) =>
      verifiedDates.has(dateKey)
    ).length;

    if (verifiedCount >= weeklyGoal || period.endDateKey < referenceDateKey) {
      continue;
    }

    const remaining = weeklyGoal - verifiedCount;

    for (const dateKey of period.dateKeys) {
      if (dateKey < referenceDateKey || verifiedDates.has(dateKey)) {
        continue;
      }

      reminders.push({
        body: `Scoring week ${period.index}: ${verifiedCount}/${weeklyGoal} verified. Complete ${remaining} more by day ${Number(period.endDateKey.slice(-2))}.`,
        dateKey,
        kind: 'period-progress',
        title: 'Keep your commitment moving'
      });
    }
  }

  for (const dateKey of calendar.bonusDateKeys) {
    if (dateKey < referenceDateKey || verifiedDates.has(dateKey)) {
      continue;
    }

    reminders.push({
      body: `One Verified workout today adds ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'} before a Perfect Month 10x.`,
      dateKey,
      kind: 'bonus-day',
      title: `+${weeklyGoal} ${weeklyGoal === 1 ? 'entry is' : 'entries are'} available today`
    });
  }

  return reminders;
}
