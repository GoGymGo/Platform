import { emptyStreakCounts, type StreakCounts } from '@/domain/streaks';
export type CompetitionPeriodIndex = 1 | 2 | 3 | 4;

export type CurrentWeekProgress = {
  index: CompetitionPeriodIndex | null;
  verifiedCount: number;
};

export type MatchAvailability = 'matched' | 'searching' | 'solo';
export type WeeklyChallengeDisplayStatus =
  | 'CHOOSE PARTNER'
  | 'COMPLETE'
  | 'IN PROGRESS'
  | 'INVITE WAITING'
  | 'PAIRING PENDING';

export type CompetitionPhase =
  | 'before-month'
  | 'scoring-period'
  | 'bonus-days'
  | 'complete';

export function getCompetitionRankLabel({
  competitionNotStarted,
  hasSettledWeek,
  rank
}: {
  competitionNotStarted: boolean;
  hasSettledWeek: boolean;
  rank?: number;
}) {
  if (competitionNotStarted || !hasSettledWeek) {
    return 'PENDING FIRST WEEK';
  }

  return rank ? `#${rank}` : 'UPDATING';
}

export function getWeeklyChallengeDisplayStatus({
  activeAvailability,
  hasFeaturedPartner,
  hasIncomingRequest,
  isRemainderDayPhase
}: {
  activeAvailability?: MatchAvailability;
  hasFeaturedPartner: boolean;
  hasIncomingRequest: boolean;
  isRemainderDayPhase: boolean;
}): WeeklyChallengeDisplayStatus {
  if (isRemainderDayPhase) {
    return 'COMPLETE';
  }

  if (activeAvailability === 'matched') {
    return 'IN PROGRESS';
  }

  if (hasIncomingRequest) {
    return 'INVITE WAITING';
  }

  if (activeAvailability || hasFeaturedPartner) {
    return 'CHOOSE PARTNER';
  }

  return 'PAIRING PENDING';
}

export type CompetitionPeriod = {
  dateKeys: readonly string[];
  endDateKey: string;
  index: CompetitionPeriodIndex;
  startDateKey: string;
};

export type CompetitionMatch = {
  availability: MatchAvailability;
  entries: number;
  multiplier: 0 | 1 | 2 | 3;
  opponentAlias: string | null;
  opponentBestStreak: number;
  opponentCurrentStreak: number;
  opponentMonthlyVerifiedDays: number;
  opponentStreaks: StreakCounts;
  opponentVerifiedCount: number;
  periodIndex: CompetitionPeriodIndex;
  region: string;
  scoringStatus: 'projected' | 'settled';
};

export type CompetitionPeriodStatus =
  | 'future'
  | 'in-progress'
  | 'pending-settlement'
  | 'settled'
  | 'ineligible';

export type CompetitionPeriodResult = {
  availability: MatchAvailability;
  bonusWorkoutCompleted: boolean;
  entries: number;
  finalMultiplier: 0 | 1 | 2 | 3;
  index: CompetitionPeriodIndex;
  liveMultiplier: 0 | 1 | 2 | 3;
  opponentAlias: string;
  opponentBestStreak: number;
  opponentCurrentStreak: number;
  opponentGoalMet: boolean;
  opponentMonthlyVerifiedDays: number;
  opponentStreaks: StreakCounts;
  opponentVerifiedCount: number;
  period: CompetitionPeriod;
  projectedEntries: number;
  region: string;
  scoringStatus: 'projected' | 'settled';
  status: CompetitionPeriodStatus;
  userGoalMet: boolean;
  userVerifiedCount: number;
  userVerifiedDateKeys: readonly string[];
};

export type MonthlyCompetitionResult = {
  bonusDateKeys: readonly string[];
  bonusDayEntries: number;
  competitionMonthKey: string;
  currentPeriod: CompetitionPeriodResult | null;
  phase: CompetitionPhase;
  perfectMonthAchieved: boolean;
  perfectMonthEligible: boolean;
  perfectMonthMultiplier: 1 | 10;
  periodEntriesBeforePerfectMonth: number;
  periodResults: readonly CompetitionPeriodResult[];
  totalCompetitionEntries: number;
  weeklyGoal: number;
};

export function canLoadWeeklyChallengePairing({
  hasCurrentPeriod,
  phase
}: {
  hasCurrentPeriod: boolean;
  phase: CompetitionPhase;
}): boolean {
  return phase === 'scoring-period' && hasCurrentPeriod;
}

export type EvaluateMonthlyCompetitionInput = {
  competitionMonthKey: string;
  eligibleFromDateKey?: string;
  matches: readonly CompetitionMatch[];
  perfectMonthEligible?: boolean;
  referenceDateKey: string;
  userVerifiedDateKeys: readonly string[];
  weeklyGoal: number;
};

export const competitionRules = {
  firstBonusDay: 29,
  maximumWeeklyGoal: 7,
  minimumWeeklyGoal: 1,
  perfectMonthMultiplier: 10,
  scoringPeriodCount: 4
} as const;

const periodBounds = [
  [1, 7],
  [8, 14],
  [15, 21],
  [22, 28]
] as const;

export function evaluateMonthlyCompetition({
  competitionMonthKey,
  eligibleFromDateKey = `${competitionMonthKey}-01`,
  matches,
  perfectMonthEligible = true,
  referenceDateKey,
  userVerifiedDateKeys,
  weeklyGoal
}: EvaluateMonthlyCompetitionInput): MonthlyCompetitionResult {
  const goal = clampWeeklyGoal(weeklyGoal);
  const calendar = buildCompetitionCalendar(competitionMonthKey);
  const visibleUserDates = uniqueDateKeys(userVerifiedDateKeys).filter(
    (dateKey) =>
      dateKey.startsWith(`${competitionMonthKey}-`) &&
      dateKey >= eligibleFromDateKey &&
      dateKey <= referenceDateKey
  );

  const periodResults = calendar.periods.map((period) => {
    const periodEligible = period.endDateKey >= eligibleFromDateKey;
    const match = matches.find((candidate) => candidate.periodIndex === period.index);
    const availability = match?.availability ?? 'searching';
    const userDates = periodEligible ? datesInsidePeriod(visibleUserDates, period) : [];
    const calendarStatus = periodEligible
      ? getPeriodStatus(period, referenceDateKey)
      : 'ineligible';
    const status = calendarStatus === 'settled' && match?.scoringStatus !== 'settled'
      ? 'pending-settlement'
      : calendarStatus;
    const userGoalMet = userDates.length >= goal;
    const opponentVerifiedCount = periodEligible
      ? (match?.opponentVerifiedCount ?? 0)
      : 0;
    const opponentGoalMet =
      availability === 'matched' && opponentVerifiedCount >= goal;
    const bonusWorkoutCompleted = userGoalMet && userDates.length > goal;
    const liveMultiplier = match?.multiplier ?? 0;
    const finalMultiplier = match?.scoringStatus === 'settled'
      ? match.multiplier
      : 0;

    return {
      availability,
      bonusWorkoutCompleted,
      entries: match?.scoringStatus === 'settled' ? match.entries : 0,
      finalMultiplier,
      index: period.index,
      liveMultiplier,
      opponentAlias: match?.opponentAlias ?? 'SOLO MODE',
      opponentBestStreak: match?.opponentBestStreak ?? 0,
      opponentCurrentStreak: match?.opponentCurrentStreak ?? 0,
      opponentGoalMet,
      opponentMonthlyVerifiedDays: match?.opponentMonthlyVerifiedDays ?? 0,
      opponentStreaks: match?.opponentStreaks ?? emptyStreakCounts,
      opponentVerifiedCount,
      period,
      projectedEntries: match?.entries ?? 0,
      region: match?.region ?? 'YOUR REGION',
      scoringStatus: match?.scoringStatus ?? 'projected',
      status,
      userGoalMet,
      userVerifiedCount: userDates.length,
      userVerifiedDateKeys: userDates
    } satisfies CompetitionPeriodResult;
  });

  const eligiblePeriodResults = periodResults.filter(
    (period) => period.status !== 'ineligible'
  );
  const allPeriodsSettled =
    eligiblePeriodResults.length > 0 &&
    eligiblePeriodResults.every((period) => period.status === 'settled');
  const perfectMonthAchieved =
    perfectMonthEligible &&
    allPeriodsSettled &&
    eligiblePeriodResults.every((period) => period.userGoalMet);
  const perfectMonthMultiplier = perfectMonthAchieved
    ? competitionRules.perfectMonthMultiplier
    : 1;
  const periodEntriesBeforePerfectMonth = periodResults.reduce(
    (total, period) => total + period.entries,
    0
  );
  const bonusDateKeys = visibleUserDates.filter((dateKey) =>
    calendar.bonusDateKeys.includes(dateKey)
  );
  const bonusDayEntries = bonusDateKeys.length * goal;
  const phase = getCompetitionPhase(calendar, referenceDateKey);

  return {
    bonusDateKeys,
    bonusDayEntries,
    competitionMonthKey,
    currentPeriod:
      phase === 'scoring-period'
        ? periodResults.find((period) => period.status === 'in-progress') ?? null
        : null,
    phase,
    perfectMonthAchieved,
    perfectMonthEligible,
    perfectMonthMultiplier,
    periodEntriesBeforePerfectMonth,
    periodResults,
    totalCompetitionEntries:
      (periodEntriesBeforePerfectMonth + bonusDayEntries) * perfectMonthMultiplier,
    weeklyGoal: goal
  };
}

export type EligibleWeeklyChallengePartner = {
  alias: string;
  goalDays: number;
  requestStatus: 'available' | 'pending';
  streaks: StreakCounts;
  userId: string;
};

export type WeeklyChallengeRequest = {
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  goalDays: number;
  id: string;
  partnerAlias: string;
  partnerStreaks: StreakCounts;
  periodIndex: CompetitionPeriodIndex;
  status: 'accepted' | 'cancelled' | 'declined' | 'pending';
};

export function buildCompetitionCalendar(monthKey: string) {
  const { month, year } = parseMonthKey(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const periods = periodBounds.map(([startDay, endDay], index) => {
    const periodIndex = (index + 1) as CompetitionPeriodIndex;

    return {
      dateKeys: buildDateKeyRange(monthKey, startDay, endDay),
      endDateKey: formatMonthDay(monthKey, endDay),
      index: periodIndex,
      startDateKey: formatMonthDay(monthKey, startDay)
    } satisfies CompetitionPeriod;
  });
  const bonusDateKeys = daysInMonth >= competitionRules.firstBonusDay
    ? buildDateKeyRange(monthKey, competitionRules.firstBonusDay, daysInMonth)
    : [];

  return {
    bonusDateKeys,
    competitionEndDateKey: formatMonthDay(monthKey, daysInMonth),
    competitionStartDateKey: formatMonthDay(monthKey, 1),
    periods
  } as const;
}

export function getCompetitionMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

export function getCompetitionRegionDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function formatCompetitionOpeningDateTime(value: string, timeZone: string) {
  const date = new Date(value);
  const includesSubMinutePrecision =
    date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0;

  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'long',
    ...(includesSubMinutePrecision ? { second: '2-digit' } : {}),
    timeZone,
    timeZoneName: 'short',
    year: 'numeric'
  }).format(date);
}

export function hasCompetitionStarted(
  startsAt: string | null | undefined,
  now = Date.now()
) {
  if (!startsAt) return false;

  const startTime = Date.parse(startsAt);
  return Number.isFinite(startTime) && now >= startTime;
}

export function isCompetitionBonusDay(dateKey: string) {
  const monthKey = getCompetitionMonthKey(dateKey);

  return buildCompetitionCalendar(monthKey).bonusDateKeys.includes(dateKey);
}

export function getCurrentWeekProgress(
  referenceDateKey: string,
  verifiedDateKeys: readonly string[]
): CurrentWeekProgress {
  const day = Number(referenceDateKey.slice(-2));

  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return { index: null, verifiedCount: 0 };
  }

  const index = Math.ceil(day / 7) as CompetitionPeriodIndex;
  const startDay = (index - 1) * 7 + 1;
  const startDateKey = formatMonthDay(getCompetitionMonthKey(referenceDateKey), startDay);
  const endDateKey = formatMonthDay(getCompetitionMonthKey(referenceDateKey), startDay + 6);
  const verifiedCount = uniqueDateKeys(verifiedDateKeys).filter(
    (dateKey) => dateKey >= startDateKey && dateKey <= endDateKey
  ).length;

  return { index, verifiedCount };
}

export function clampWeeklyGoal(goal: number) {
  const finiteGoal = Number.isFinite(goal) ? Math.round(goal) : 4;

  return Math.min(
    competitionRules.maximumWeeklyGoal,
    Math.max(competitionRules.minimumWeeklyGoal, finiteGoal)
  );
}

function getCompetitionPhase(
  calendar: ReturnType<typeof buildCompetitionCalendar>,
  referenceDateKey: string
): CompetitionPhase {
  if (referenceDateKey < calendar.competitionStartDateKey) {
    return 'before-month';
  }

  if (referenceDateKey > calendar.competitionEndDateKey) {
    return 'complete';
  }

  if (calendar.bonusDateKeys.includes(referenceDateKey)) {
    return 'bonus-days';
  }

  return 'scoring-period';
}

function getPeriodStatus(
  period: CompetitionPeriod,
  referenceDateKey: string
): CompetitionPeriodStatus {
  if (referenceDateKey < period.startDateKey) {
    return 'future';
  }

  return referenceDateKey <= period.endDateKey ? 'in-progress' : 'settled';
}

function datesInsidePeriod(
  dateKeys: readonly string[],
  period: CompetitionPeriod
) {
  return dateKeys.filter(
    (dateKey) => dateKey >= period.startDateKey && dateKey <= period.endDateKey
  );
}

function uniqueDateKeys(dateKeys: readonly string[]) {
  return Array.from(new Set(dateKeys)).sort();
}

function buildDateKeyRange(monthKey: string, startDay: number, endDay: number) {
  return Array.from(
    { length: Math.max(0, endDay - startDay + 1) },
    (_, index) => formatMonthDay(monthKey, startDay + index)
  );
}

function formatMonthDay(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

function parseMonthKey(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`Invalid contest month key: ${monthKey}`);
  }

  const [year, month] = monthKey.split('-').map(Number);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid contest month key: ${monthKey}`);
  }

  return { month, year };
}
