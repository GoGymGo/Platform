import type { ParticipantCompetitionResults } from '@/domain/rewards';

export const competitionResultsRefetchMs = 5_000;

export function getCompetitionResultsRefetchInterval(
  results: Pick<ParticipantCompetitionResults, 'resultsStatus'> | null | undefined
) {
  return results?.resultsStatus === 'settled' ? false : competitionResultsRefetchMs;
}

export function getRewardAwardsRefetchInterval(awards: readonly unknown[] | undefined) {
  return awards && awards.length > 0 ? false : competitionResultsRefetchMs;
}
