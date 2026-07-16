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
      opponentBestStreak: 12 - index,
      opponentCurrentStreak: 4 + index,
      opponentMonthlyVerifiedDays: target + index * weeklyGoal,
      opponentStreaks: {
        daily: 4 + index,
        monthly: index > 1 ? 1 : 0,
        weekly: 2 + index,
        yearly: 0
      },
      opponentUserId: `preview-opponent-${index + 1}`,
      opponentVerifiedDateKeys,
      periodIndex: period.index,
      region: 'TORONTO'
    } satisfies CompetitionMatch;
  });
}
