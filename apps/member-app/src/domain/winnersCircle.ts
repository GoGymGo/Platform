export function shouldAutoPresentWinnersCircle(
  regionalDateKey: string,
  lastSeenLoginMonthKey: string | null
) {
  const loginMonthKey = regionalDateKey.slice(0, 7);

  return regionalDateKey.endsWith('-01') && lastSeenLoginMonthKey !== loginMonthKey;
}

export function getPreviousCompetitionMonthKey(loginMonthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(loginMonthKey);

  if (!match) {
    throw new Error(`Invalid month key: ${loginMonthKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${loginMonthKey}`);
  }

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;

  return `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
}

export function formatCompetitionMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);

  if (!year || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
