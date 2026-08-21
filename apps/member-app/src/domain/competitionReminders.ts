import { buildCompetitionCalendar } from './competition';

export const competitionReminderSchedule = {
  bonusDayTime: '09:00',
  maximumScheduled: 40,
  weeklyChallengeTime: '18:15',
  weeklyGoalTime: '18:00'
} as const;

export type CompetitionReminderPermission =
  | 'checking'
  | 'denied'
  | 'granted'
  | 'provisional'
  | 'undetermined'
  | 'unavailable';

export type CompetitionReminder = {
  body: string;
  dateKey: string;
  kind: 'bonus-day' | 'weekly-challenge' | 'weekly-goal';
  localTime: string;
  title: string;
};

export type CompetitionReminderState = {
  localSchedule: {
    count: number;
    status: 'disabled' | 'error' | 'retry' | 'scheduled' | 'unavailable';
    timeZone: string;
  };
  permission: CompetitionReminderPermission;
  preference: 'disabled' | 'enabled';
  pushRegistration: {
    status: 'disabled' | 'error' | 'registered' | 'retry' | 'unavailable';
  };
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

    if (period.endDateKey < referenceDateKey) {
      continue;
    }

    if (verifiedCount < weeklyGoal) {
      for (const dateKey of period.dateKeys) {
        if (dateKey < referenceDateKey || verifiedDates.has(dateKey)) {
          continue;
        }

        reminders.push({
          body: `Open GoGymGo to check your ${weeklyGoal}-day Weekly Goal before scoring week ${period.index} closes.`,
          dateKey,
          kind: 'weekly-goal',
          localTime: competitionReminderSchedule.weeklyGoalTime,
          title: 'Weekly Goal reminder'
        });
      }
    }

    reminders.push({
      body: `Open GoGymGo to check the current facts for scoring week ${period.index} before it closes.`,
      dateKey: period.endDateKey,
      kind: 'weekly-challenge',
      localTime: competitionReminderSchedule.weeklyChallengeTime,
      title: 'Weekly Challenge check-in'
    });
  }

  for (const dateKey of calendar.bonusDateKeys) {
    if (dateKey < referenceDateKey || verifiedDates.has(dateKey)) {
      continue;
    }

    reminders.push({
      body: `A Verified workout today can add ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'}. Open GoGymGo for current eligibility.`,
      dateKey,
      kind: 'bonus-day',
      localTime: competitionReminderSchedule.bonusDayTime,
      title: 'Bonus Day reminder'
    });
  }

  return reminders
    .sort((left, right) =>
      `${left.dateKey}T${left.localTime}-${left.kind}`.localeCompare(
        `${right.dateKey}T${right.localTime}-${right.kind}`
      )
    )
    .slice(0, competitionReminderSchedule.maximumScheduled);
}

export function createCompetitionReminderState(
  timeZone: string
): CompetitionReminderState {
  return {
    localSchedule: { count: 0, status: 'disabled', timeZone },
    permission: 'checking',
    preference: 'disabled',
    pushRegistration: { status: 'disabled' }
  };
}

export function permitsCompetitionReminders(
  permission: CompetitionReminderPermission
) {
  return permission === 'granted' || permission === 'provisional';
}

export function toCompetitionReminderDate(
  reminder: Pick<CompetitionReminder, 'dateKey' | 'localTime'>,
  timeZone: string
) {
  const [year, month, day] = reminder.dateKey.split('-').map(Number);
  const [hour, minute] = reminder.localTime.split(':').map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    throw new Error('The competition reminder schedule is invalid.');
  }

  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desiredAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    candidate += desiredAsUtc - actualAsUtc;
  }

  const resolved = new Date(candidate);
  const actual = zonedParts(resolved, timeZone);
  if (
    actual.year !== year ||
    actual.month !== month ||
    actual.day !== day ||
    actual.hour !== hour ||
    actual.minute !== minute
  ) {
    throw new Error('The competition reminder time does not exist.');
  }
  return resolved;
}

function zonedParts(date: Date, timeZone: string) {
  const values = new Map(
    new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric'
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    month: Number(values.get('month')),
    year: Number(values.get('year'))
  };
}
