// @ts-check

export const defaultContestTimeZone = "America/Vancouver";

const minuteMilliseconds = 60 * 1_000;
const workoutCompletionGraceMilliseconds = 15 * minuteMilliseconds;

/**
 * @param {string | Date} value
 * @param {string} timeZone
 */
export function toZonedDateTimeInput(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time.");
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${twoDigits(parts.month)}-${twoDigits(parts.day)}T${twoDigits(parts.hour)}:${twoDigits(parts.minute)}`;
}

/**
 * Convert a timezone-free datetime-local value into an unambiguous instant in
 * the contest region. Nonexistent and repeated daylight-saving times are
 * rejected instead of silently moving the contest by an hour.
 *
 * @param {string} value
 * @param {string} timeZone
 */
export function zonedDateTimeToIso(value, timeZone) {
  const desired = parseDateTimeInput(value);
  assertTimeZone(timeZone);
  const wallClockUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  const offsets = new Set(
    [-24, -12, 0, 12, 24].map((hours) =>
      timeZoneOffsetMilliseconds(
        new Date(wallClockUtc + hours * 60 * minuteMilliseconds),
        timeZone,
      ),
    ),
  );
  const candidates = [...offsets]
    .map((offset) => new Date(wallClockUtc - offset))
    .filter((candidate) => sameWallClock(zonedParts(candidate, timeZone), desired))
    .map((candidate) => candidate.getTime());
  const uniqueCandidates = [...new Set(candidates)].sort((left, right) => left - right);

  if (uniqueCandidates.length === 0) {
    throw new Error(
      `That local time does not exist in ${timeZone} because of a daylight-saving change. Choose another time.`,
    );
  }
  if (uniqueCandidates.length > 1) {
    throw new Error(
      `That local time occurs twice in ${timeZone} because of a daylight-saving change. Choose another time.`,
    );
  }
  return new Date(uniqueCandidates[0]).toISOString();
}

/**
 * @param {string | Date} value
 * @param {string} timeZone
 */
export function formatContestDateTime(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}

/** @param {string | Date} endsAt */
export function contestWorkoutCutoffs(endsAt) {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  return {
    completionDeadline: new Date(
      end.getTime() + workoutCompletionGraceMilliseconds,
    ).toISOString(),
    startBefore: new Date(
      end.getTime() - workoutCompletionGraceMilliseconds,
    ).toISOString(),
  };
}

/**
 * @param {string} value
 * @param {string} timeZone
 */
export function contestWorkoutCutoffsFromInput(value, timeZone) {
  try {
    return contestWorkoutCutoffs(zonedDateTimeToIso(value, timeZone));
  } catch {
    return null;
  }
}

/**
 * @param {string} timeZone
 * @param {Date} [now]
 */
export function defaultCompetitionDatesInZone(timeZone, now = new Date()) {
  const nowParts = zonedParts(now, timeZone);
  const startMonth = nowParts.month === 12 ? 1 : nowParts.month + 1;
  const startYear = nowParts.month === 12 ? nowParts.year + 1 : nowParts.year;
  const endMonth = startMonth === 12 ? 1 : startMonth + 1;
  const endYear = startMonth === 12 ? startYear + 1 : startYear;
  const startInput = `${startYear}-${twoDigits(startMonth)}-01T00:00`;
  const endInput = `${endYear}-${twoDigits(endMonth)}-01T00:00`;
  return {
    endsAt: zonedDateTimeToIso(endInput, timeZone),
    monthKey: `${startYear}-${twoDigits(startMonth)}`,
    registrationOpensAt: now.toISOString(),
    startsAt: zonedDateTimeToIso(startInput, timeZone),
  };
}

/** @param {string} timeZone */
function assertTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format();
  } catch {
    throw new Error("Choose a region with a valid timezone.");
  }
}

/** @param {string} value */
function parseDateTimeInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid date and time.");
  const desired = {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
  const normalized = new Date(
    Date.UTC(
      desired.year,
      desired.month - 1,
      desired.day,
      desired.hour,
      desired.minute,
    ),
  );
  if (
    normalized.getUTCFullYear() !== desired.year ||
    normalized.getUTCMonth() + 1 !== desired.month ||
    normalized.getUTCDate() !== desired.day ||
    normalized.getUTCHours() !== desired.hour ||
    normalized.getUTCMinutes() !== desired.minute
  ) {
    throw new Error("Enter a valid date and time.");
  }
  return desired;
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
function zonedParts(date, timeZone) {
  assertTimeZone(timeZone);
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    second: values.second,
    year: values.year,
  };
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
function timeZoneOffsetMilliseconds(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

/**
 * @param {{day: number, hour: number, minute: number, month: number, year: number}} actual
 * @param {{day: number, hour: number, minute: number, month: number, year: number}} desired
 */
function sameWallClock(actual, desired) {
  return (
    actual.year === desired.year &&
    actual.month === desired.month &&
    actual.day === desired.day &&
    actual.hour === desired.hour &&
    actual.minute === desired.minute
  );
}

/** @param {number} value */
function twoDigits(value) {
  return String(value).padStart(2, "0");
}
