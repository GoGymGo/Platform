import { normalizeDateKey } from '../../database/date-key';

export function socialChallengeDateWindow(
  challenges: readonly {
    end_date: Date | string;
    start_date: Date | string;
  }[],
): { endDate: string; startDate: string } | null {
  if (challenges.length === 0) return null;

  const startDates = challenges.map(({ start_date }) =>
    normalizeDateKey(start_date),
  );
  const endDates = challenges.map(({ end_date }) => normalizeDateKey(end_date));
  return {
    endDate: endDates.reduce((latest, value) =>
      value > latest ? value : latest,
    ),
    startDate: startDates.reduce((earliest, value) =>
      value < earliest ? value : earliest,
    ),
  };
}
