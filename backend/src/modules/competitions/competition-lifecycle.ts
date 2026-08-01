export type CompetitionStartResolution = 'active' | 'cancelled';

export function resolveCompetitionStart(
  minimumEntrants: number,
  activeEntrants: number,
): CompetitionStartResolution {
  return activeEntrants >= minimumEntrants ? 'active' : 'cancelled';
}
