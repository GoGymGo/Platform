import type { CompetitionMatch } from '@/domain/competition';

export const competitionEnrollmentRefreshQueryKeys = [
  ['competition-progress'],
  ['competition-matches'],
  ['weekly-challenge-partners'],
  ['weekly-challenge-requests']
] as const;

const searchingMatchRefreshIntervalMs = 5_000;

export function getCompetitionMatchRefetchInterval(
  matches: readonly Pick<CompetitionMatch, 'availability'>[] | undefined
) {
  if (
    !matches ||
    matches.length === 0 ||
    matches.some(({ availability }) => availability === 'searching')
  ) {
    return searchingMatchRefreshIntervalMs;
  }

  return false;
}
