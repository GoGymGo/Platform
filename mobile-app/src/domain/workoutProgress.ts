export type WorkoutLogSource = 'verified' | 'manual';

export type WorkoutVerificationMethod = 'heartRate' | 'partnerGymQr';

export type PersistedActiveWorkoutSession = {
  averageHeartRateBpm: number;
  dateKey: string;
  heartRateObservedSeconds: number;
  heartRateTotalBpmSeconds: number;
  id: string;
  lastHeartRateSampleElapsedSeconds: number;
  midSessionCheckAtSeconds: number;
  midSessionCheckPrompted: boolean;
  midSessionCheckPromptedAt: string | null;
  midSessionVerified: boolean;
  serverManaged: true;
  startedAt: string;
  verificationMethod: WorkoutVerificationMethod;
};

export type WorkoutLog = {
  createdAt: string;
  dateKey: string;
  durationMinutes: number;
  entriesEarned: number;
  exercises: string;
  id: string;
  source: WorkoutLogSource;
  title: string;
};

export function parseStoredWorkoutLogs(value: string | null): WorkoutLog[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.filter(isWorkoutLog) : [];
  } catch {
    return [];
  }
}

export function parseStoredActiveWorkoutSession(
  value: string | null
): PersistedActiveWorkoutSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return isActiveWorkoutSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type CalendarDayStatus = 'empty' | 'manual' | 'verified';

export type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  status: CalendarDayStatus;
};

export type SessionCompletionStatus =
  | 'already-verified'
  | 'completed'
  | 'heart-rate-target-not-met'
  | 'minimum-not-met'
  | 'missing-mid-session-check'
  | 'no-active-session'
  | 'pending-review'
  | 'rejected';

type SessionCompletionCandidate = {
  averageHeartRateBpm: number;
  dateKey: string;
  heartRateObservedSeconds: number;
  midSessionVerified: boolean;
  startedAt: string;
  verificationMethod: WorkoutVerificationMethod;
};

export const workoutRules = {
  defaultWeeklyGoal: 4,
  maximumManualDurationMinutes: 1440,
  midSessionCheckGraceSeconds: 120,
  midSessionCheckEarliestSeconds: 600,
  midSessionCheckLatestSeconds: 1200,
  minimumAverageHeartRateBpm: 100,
  minimumSessionSeconds: 1800,
  signupEntries: 1
} as const;

function isWorkoutLog(value: unknown): value is WorkoutLog {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.createdAt === 'string' &&
    typeof candidate.dateKey === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.dateKey) &&
    typeof candidate.durationMinutes === 'number' &&
    Number.isFinite(candidate.durationMinutes) &&
    typeof candidate.entriesEarned === 'number' &&
    Number.isFinite(candidate.entriesEarned) &&
    typeof candidate.exercises === 'string' &&
    typeof candidate.id === 'string' &&
    (candidate.source === 'verified' || candidate.source === 'manual') &&
    typeof candidate.title === 'string'
  );
}

function isActiveWorkoutSession(
  value: unknown
): value is PersistedActiveWorkoutSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const startedAt = typeof candidate.startedAt === 'string'
    ? Date.parse(candidate.startedAt)
    : Number.NaN;
  const promptedAt = candidate.midSessionCheckPromptedAt;

  return (
    typeof candidate.averageHeartRateBpm === 'number' &&
    Number.isFinite(candidate.averageHeartRateBpm) &&
    typeof candidate.dateKey === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.dateKey) &&
    typeof candidate.heartRateObservedSeconds === 'number' &&
    Number.isFinite(candidate.heartRateObservedSeconds) &&
    typeof candidate.heartRateTotalBpmSeconds === 'number' &&
    Number.isFinite(candidate.heartRateTotalBpmSeconds) &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.lastHeartRateSampleElapsedSeconds === 'number' &&
    Number.isFinite(candidate.lastHeartRateSampleElapsedSeconds) &&
    typeof candidate.midSessionCheckAtSeconds === 'number' &&
    Number.isFinite(candidate.midSessionCheckAtSeconds) &&
    typeof candidate.midSessionCheckPrompted === 'boolean' &&
    (promptedAt === null || (
      typeof promptedAt === 'string' &&
      Number.isFinite(Date.parse(promptedAt))
    )) &&
    typeof candidate.midSessionVerified === 'boolean' &&
    candidate.serverManaged === true &&
    Number.isFinite(startedAt) &&
    (candidate.verificationMethod === 'heartRate' ||
      candidate.verificationMethod === 'partnerGymQr')
  );
}

export function getMidSessionGraceSecondsRemaining(
  promptedAt: string | null,
  referenceDate = new Date()
) {
  if (!promptedAt) {
    return 0;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((referenceDate.getTime() - new Date(promptedAt).getTime()) / 1000)
  );

  return Math.max(0, workoutRules.midSessionCheckGraceSeconds - elapsedSeconds);
}

export function getRandomMidSessionCheckSecond(randomValue = Math.random()) {
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(1, Math.max(0, randomValue))
    : 0.5;
  const windowSeconds =
    workoutRules.midSessionCheckLatestSeconds -
    workoutRules.midSessionCheckEarliestSeconds;

  return workoutRules.midSessionCheckEarliestSeconds +
    Math.round(windowSeconds * normalizedRandom);
}

export function getAverageHeartRateBpm(totalBpmSeconds: number, observedSeconds: number) {
  if (!Number.isFinite(totalBpmSeconds) || observedSeconds <= 0) {
    return 0;
  }

  return Math.round(totalBpmSeconds / observedSeconds);
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDateKey(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short'
  });
}

export function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
}

export function buildCalendarDays(
  referenceDate: Date,
  logs: readonly WorkoutLog[]
): readonly CalendarDay[] {
  const logsByDate = indexLogsByDate(logs);
  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = addDays(firstOfMonth, -startOffset);
  const todayKey = toDateKey(referenceDate);

  return Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = addDays(gridStart, index);
    const dateKey = toDateKey(date);
    const dayLogs = logsByDate.get(dateKey) ?? [];
    const hasVerified = dayLogs.some((log) => log.source === 'verified');
    const hasManual = dayLogs.some((log) => log.source === 'manual');

    return {
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === referenceDate.getMonth(),
      isToday: dateKey === todayKey,
      status: hasVerified ? 'verified' : hasManual ? 'manual' : 'empty'
    };
  });
}

export function calculateCurrentStreak(
  dateKeys: readonly string[],
  referenceDate = new Date()
) {
  const workedOutDates = new Set(dateKeys);
  const startingDate = workedOutDates.has(toDateKey(referenceDate))
    ? referenceDate
    : addDays(referenceDate, -1);
  let streak = 0;

  for (let offset = 0; offset < 366; offset += 1) {
    const dateKey = toDateKey(addDays(startingDate, -offset));

    if (!workedOutDates.has(dateKey)) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export function calculateBestStreak(dateKeys: readonly string[]) {
  const sortedKeys = Array.from(new Set(dateKeys)).sort();
  let best = 0;
  let current = 0;
  let previousDate: Date | null = null;

  for (const dateKey of sortedKeys) {
    const date = parseDateKey(dateKey);
    const isConsecutive =
      previousDate !== null && toDateKey(addDays(previousDate, 1)) === dateKey;

    current = isConsecutive ? current + 1 : 1;
    best = Math.max(best, current);
    previousDate = date;
  }

  return best;
}

export function getSessionElapsedSeconds(
  startedAt: string,
  referenceDate = new Date(),
  timeScale = 1
) {
  const elapsedMilliseconds = Math.max(
    0,
    referenceDate.getTime() - new Date(startedAt).getTime()
  );

  return Math.floor((elapsedMilliseconds / 1000) * Math.max(1, timeScale));
}

export function evaluateSessionCompletion(
  session: SessionCompletionCandidate | null,
  logs: readonly WorkoutLog[],
  referenceDate = new Date(),
  timeScale = 1
): SessionCompletionStatus {
  if (!session) {
    return 'no-active-session';
  }

  if (!session.midSessionVerified) {
    return 'missing-mid-session-check';
  }

  if (
    getSessionElapsedSeconds(session.startedAt, referenceDate, timeScale) <
    workoutRules.minimumSessionSeconds
  ) {
    return 'minimum-not-met';
  }

  if (
    session.verificationMethod === 'heartRate' &&
    (session.heartRateObservedSeconds < workoutRules.minimumSessionSeconds ||
      session.averageHeartRateBpm < workoutRules.minimumAverageHeartRateBpm)
  ) {
    return 'heart-rate-target-not-met';
  }

  const alreadyVerifiedToday = logs.some(
    (log) => log.dateKey === session.dateKey && log.source === 'verified'
  );

  return alreadyVerifiedToday ? 'already-verified' : 'completed';
}

export function sanitizeManualDuration(durationMinutes: number) {
  const finiteDuration = Number.isFinite(durationMinutes) ? durationMinutes : 1;

  return Math.min(
    workoutRules.maximumManualDurationMinutes,
    Math.max(1, Math.round(finiteDuration))
  );
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function indexLogsByDate(logs: readonly WorkoutLog[]) {
  const logsByDate = new Map<string, WorkoutLog[]>();

  for (const log of logs) {
    const logsForDate = logsByDate.get(log.dateKey) ?? [];
    logsForDate.push(log);
    logsByDate.set(log.dateKey, logsForDate);
  }

  return logsByDate;
}

function addDays(date: Date, dayCount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayCount);

  return nextDate;
}
