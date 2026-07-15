import {
  buildCompetitionCalendar,
  type CompetitionMatch
} from '@/domain/competition';

const opponentAliases = ['JAX_FLUX', 'NOVA_LIFT', 'KIRA_PULSE', 'MOTION_X'] as const;

export function buildCompetitionMatchPreview(
  competitionMonthKey: string,
  weeklyGoal: number
): readonly CompetitionMatch[] {
  const { periods } = buildCompetitionCalendar(competitionMonthKey);

  return periods.map((period, index) => {
    const target = index === 2 ? Math.max(0, weeklyGoal - 1) : weeklyGoal;
    const opponentVerifiedDateKeys = period.dateKeys.slice(0, target);

    return {
      availability: 'matched',
      opponentAlias: opponentAliases[index],
      opponentVerifiedDateKeys,
      periodIndex: period.index,
      region: 'TORONTO'
    } satisfies CompetitionMatch;
  });
}
