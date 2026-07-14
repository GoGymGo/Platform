import type { CompetitionMode } from '../../database/database.types';

export type CompetitionStartResolution = 'active' | 'cancelled';

export function resolveCompetitionStart(
  minimumEntrants: number,
  activeEntrants: number,
  mode: CompetitionMode = 'cash',
): CompetitionStartResolution {
  if (mode === 'non_cash_demo') {
    return 'active';
  }
  return activeEntrants >= minimumEntrants ? 'active' : 'cancelled';
}
