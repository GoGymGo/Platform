export const competitionEnrollmentRules = {
  maximumWeeklyGoal: 7,
  minimumEntrants: 2
} as const;

export type CompetitionEnrollmentPolicy = {
  maximumEntrants: number | null;
  minimumEntrants: number;
};

export type CompetitionEnrollmentSummary = CompetitionEnrollmentPolicy & {
  competitionEndDateKey: string;
  competitionMonthKey: string;
  competitionStartDateKey: string;
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

  return {
    ...policy,
    competitionEndDateKey: `${competitionMonthKey}-${String(
      new Date(year, month, 0).getDate()
    ).padStart(2, '0')}`,
    competitionMonthKey,
    competitionStartDateKey: `${competitionMonthKey}-01`
  };
}

export function evaluateCompetitionEnrollment(
  summary: CompetitionEnrollmentSummary,
  currentEntrants: number,
  referenceDateKey: string
): CompetitionEnrollmentStatus {
  const entrants = sanitizeCount(currentEntrants);
  const atCapacity = summary.maximumEntrants !== null && entrants >= summary.maximumEntrants;
  const launchConfirmed = entrants >= summary.minimumEntrants;
  const competitionEnded = referenceDateKey > summary.competitionEndDateKey;

  let phase: CompetitionEnrollmentPhase;

  if (competitionEnded) {
    phase = launchConfirmed ? 'competition-complete' : 'cancelled';
  } else if (atCapacity) {
    phase = 'full';
  } else if (referenceDateKey < summary.competitionStartDateKey) {
    phase = launchConfirmed ? 'registration-ready' : 'registration-open';
  } else {
    phase = 'competition-active';
  }

  return {
    ...summary,
    atCapacity,
    currentEntrants: entrants,
    launchConfirmed,
    phase,
    registrationOpen: !competitionEnded && !atCapacity,
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

  if (registrationDateKey.startsWith(`${competitionMonthKey}-`)) {
    return registrationDateKey;
  }

  return getNextMonthStartDateKey(competitionMonthKey);
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

  return registrationDateKey.startsWith(`${competitionMonthKey}-`)
    ? competitionEnrollmentRules.maximumWeeklyGoal
    : 0;
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

  return Array.from(
    { length: competitionEnrollmentRules.maximumWeeklyGoal },
    (_, index) => index + 1
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
    throw new Error('Competition enrollment requires at least 2 entrants.');
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
