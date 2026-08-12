export function shouldAutoPresentWinnersCircle(
  presentationKey: string | null,
  lastSeenPresentationKey: string | null
) {
  return presentationKey !== null && presentationKey !== lastSeenPresentationKey;
}

export function getWinnersCirclePresentationKey({
  competitionId,
  resultsStatus
}: {
  competitionId: string;
  resultsStatus: 'pending' | 'settled';
}) {
  return `${competitionId}:${resultsStatus}`;
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
