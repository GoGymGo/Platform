export const competitionEnrollmentRules = {
  lateRegistrationEndDay: 6,
  maximumWeeklyGoal: 7,
  minimumEntrants: 100
} as const;

export type CompetitionEnrollmentPolicy = {
  maximumEntrants: number | null;
  minimumEntrants: number;
};

export type CompetitionEnrollmentSummary = CompetitionEnrollmentPolicy & {
  competitionMonthKey: string;
  lateRegistrationEndDateKey: string;
  registrationEndDateKey: string;
  registrationStartDateKey: string;
};

export type CompetitionEnrollmentPhase =
  | 'before-registration'
  | 'registration-open'
  | 'registration-ready'
  | 'full'
  | 'competition-active'
  | 'cancelled'
  | 'competition-complete';

export type CompetitionEnrollmentStatus = CompetitionEnrollmentSummary & {
  atCapacity: boolean;
  currentEntrants: number;
  lateRegistration: boolean;
  launchConfirmed: boolean;
  phase: CompetitionEnrollmentPhase;
  registrationOpen: boolean;
  spotsRemaining: number | null;
};

export function buildCompetitionEnrollmentSummary(
  competitionMonthKey: string,
  policy: CompetitionEnrollmentPolicy
): CompetitionEnrollmentSummary {
  const { month, year } = parseMonthKey(competitionMonthKey);
  validatePolicy(policy);

  const registrationMonth = new Date(year, month - 2, 1);
  const registrationYear = registrationMonth.getFullYear();
  const registrationMonthNumber = registrationMonth.getMonth() + 1;
  const registrationMonthKey = `${registrationYear}-${String(registrationMonthNumber).padStart(2, '0')}`;
  const registrationDays = new Date(registrationYear, registrationMonthNumber, 0).getDate();
  return {
    ...policy,
    competitionMonthKey,
    lateRegistrationEndDateKey: `${competitionMonthKey}-${String(competitionEnrollmentRules.lateRegistrationEndDay).padStart(2, '0')}`,
    registrationEndDateKey: `${registrationMonthKey}-${String(registrationDays).padStart(2, '0')}`,
    registrationStartDateKey: `${registrationMonthKey}-01`
  };
}

export function evaluateCompetitionEnrollment(
  summary: CompetitionEnrollmentSummary,
  currentEntrants: number,
  referenceDateKey: string
): CompetitionEnrollmentStatus {
  const entrants = sanitizeCount(currentEntrants);
  const competitionEndDateKey = getCompetitionEndDateKey(summary.competitionMonthKey);
  const lateRegistrationWindowOpen =
    referenceDateKey > summary.registrationEndDateKey &&
    referenceDateKey <= summary.lateRegistrationEndDateKey;
  const atCapacity = summary.maximumEntrants !== null && entrants >= summary.maximumEntrants;
  const launchConfirmed = entrants >= summary.minimumEntrants;

  let phase: CompetitionEnrollmentPhase;

  if (referenceDateKey < summary.registrationStartDateKey) {
    phase = 'before-registration';
  } else if (referenceDateKey <= summary.registrationEndDateKey) {
    phase = atCapacity
      ? 'full'
      : launchConfirmed
        ? 'registration-ready'
        : 'registration-open';
  } else if (referenceDateKey <= competitionEndDateKey) {
    phase = launchConfirmed
      ? atCapacity
        ? 'full'
        : 'competition-active'
      : 'cancelled';
  } else {
    phase = launchConfirmed ? 'competition-complete' : 'cancelled';
  }

  return {
    ...summary,
    atCapacity,
    currentEntrants: entrants,
    lateRegistration:
      lateRegistrationWindowOpen,
    launchConfirmed,
    phase,
    registrationOpen:
      phase === 'registration-open' ||
      phase === 'registration-ready' ||
      (phase === 'competition-active' && lateRegistrationWindowOpen),
    spotsRemaining: summary.maximumEntrants === null
      ? null
      : Math.max(0, summary.maximumEntrants - entrants)
  };
}

export function getCompetitionEntryStartDateKey(
  competitionMonthKey: string,
  registrationDateKey: string
) {
  const competitionStartDateKey = `${competitionMonthKey}-01`;

  if (registrationDateKey < competitionStartDateKey) {
    return competitionStartDateKey;
  }

  if (!registrationDateKey.startsWith(`${competitionMonthKey}-`)) {
    return getNextMonthStartDateKey(competitionMonthKey);
  }

  const registrationDay = Number(registrationDateKey.slice(-2));

  if (registrationDay <= competitionEnrollmentRules.lateRegistrationEndDay) {
    return registrationDateKey;
  }

  return getNextMonthStartDateKey(competitionMonthKey);
}

export function getRegistrationTargetCompetitionMonthKey(referenceDateKey: string) {
  validateDateKey(referenceDateKey);
  const currentMonthKey = referenceDateKey.slice(0, 7);
  const currentDay = Number(referenceDateKey.slice(-2));

  return currentDay <= competitionEnrollmentRules.lateRegistrationEndDay
    ? currentMonthKey
    : getNextCompetitionMonthKey(currentMonthKey);
}

export function getRegistrationGoalLimit(
  competitionMonthKey: string,
  registrationDateKey: string
) {
  validateDateKey(registrationDateKey);
  const competitionStartDateKey = `${competitionMonthKey}-01`;

  if (registrationDateKey < competitionStartDateKey) {
    return competitionEnrollmentRules.maximumWeeklyGoal;
  }

  if (!registrationDateKey.startsWith(`${competitionMonthKey}-`)) {
    return 0;
  }

  const registrationDay = Number(registrationDateKey.slice(-2));

  if (registrationDay > competitionEnrollmentRules.lateRegistrationEndDay) {
    return 0;
  }

  return competitionEnrollmentRules.maximumWeeklyGoal - registrationDay + 1;
}

export function getRegistrationGoalOptions(
  competitionMonthKey: string,
  registrationDateKey: string
): readonly number[] {
  const goalLimit = getRegistrationGoalLimit(
    competitionMonthKey,
    registrationDateKey
  );

  if (goalLimit === 0) {
    return [];
  }

  if (isLateCompetitionRegistration(competitionMonthKey, registrationDateKey)) {
    return [goalLimit];
  }

  return Array.from(
    { length: competitionEnrollmentRules.maximumWeeklyGoal },
    (_, index) => index + 1
  );
}

export function isLateCompetitionRegistration(
  competitionMonthKey: string,
  registrationDateKey: string
) {
  return (
    registrationDateKey >= `${competitionMonthKey}-01` &&
    registrationDateKey <=
      `${competitionMonthKey}-${String(competitionEnrollmentRules.lateRegistrationEndDay).padStart(2, '0')}`
  );
}

export function getNextCompetitionMonthKey(monthKey: string) {
  const { month, year } = parseMonthKey(monthKey);
  const nextMonth = new Date(year, month, 1);

  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
}

export function getCompetitionDateRange(monthKey: string) {
  return {
    endDateKey: getCompetitionEndDateKey(monthKey),
    startDateKey: `${monthKey}-01`
  };
}

function validatePolicy(policy: CompetitionEnrollmentPolicy) {
  if (
    !Number.isFinite(policy.minimumEntrants) ||
    policy.minimumEntrants < competitionEnrollmentRules.minimumEntrants
  ) {
    throw new Error('Competition enrollment requires at least 100 entrants.');
  }

  if (
    policy.maximumEntrants !== null &&
    (!Number.isFinite(policy.maximumEntrants) ||
      policy.maximumEntrants < policy.minimumEntrants)
  ) {
    throw new Error('Competition entrant cap must be at least the launch minimum.');
  }

}

function getCompetitionEndDateKey(monthKey: string) {
  const { month, year } = parseMonthKey(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();

  return `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;
}

function getNextMonthStartDateKey(monthKey: string) {
  const { month, year } = parseMonthKey(monthKey);
  const nextMonth = new Date(year, month, 1);

  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
}

function sanitizeCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function validateDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
}

function parseMonthKey(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`Invalid competition month key: ${monthKey}`);
  }

  const [year, month] = monthKey.split('-').map(Number);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid competition month key: ${monthKey}`);
  }

  return { month, year };
}
