import { goalCategories, type GoalCategory } from '@/domain/campaignEconomics';
import type { StreakCounts } from '@/domain/streaks';

export type CategoryLeaderboardRow = {
  alias: string;
  categoryEntries: number;
  rank: number;
  streaks: StreakCounts;
  verifiedDays: number;
};

export type CategoryLeaderboard = {
  goal: GoalCategory;
  rows: readonly CategoryLeaderboardRow[];
};

const aliasesByGoal: Record<GoalCategory, readonly string[]> = {
  1: ['ACE_ONE', 'RIN_GO', 'KAI_FIT', 'MILO_X', 'SOL_RUN', 'NIA_MOVE', 'JAY_SET', 'ZED_UP', 'REX_ONE', 'AVA_GO'],
  2: ['DUO_FIT', 'NOVA_2', 'JAX_LIFT', 'MAYA_GO', 'RYO_RUN', 'SKYE_X', 'LEX_MOVE', 'OMAR_2', 'KIRA_UP', 'BEAU_FIT'],
  3: ['TRI_PULSE', 'LUNA_3', 'AXEL_FIT', 'NIKO_GO', 'SAGE_RUN', 'ZARA_X', 'FINN_UP', 'MIRA_3', 'LUKE_FIT', 'ARIA_GO'],
  4: ['CORE_FOUR', 'NEON_4', 'KODA_FIT', 'IVY_RUN', 'MAKO_X', 'THEO_GO', 'NORA_UP', 'EZRA_4', 'LYRA_FIT', 'NOAH_RUN'],
  5: ['FIVE_ALIVE', 'VOLT_5', 'RHEA_FIT', 'ATLAS_X', 'JUNO_RUN', 'ORION_GO', 'EDEN_UP', 'LEO_5', 'IRIS_FIT', 'MARS_RUN'],
  6: ['SIX_SHIFT', 'NOVA_6', 'APEX_FIT', 'KNOX_X', 'VEGA_RUN', 'ARIA_GO', 'ONYX_UP', 'CLEO_6', 'RUNE_FIT', 'ZION_RUN'],
  7: ['MAX_SEVEN', 'NEONVIPER', 'KIRA_FLUX', 'BOLT_RUN', 'MARA_V', 'JAX_540', 'APEX_7', 'LUNA_X', 'NOVA_MAX', 'CORE_7']
};

const previewStreaks: readonly StreakCounts[] = [
  { daily: 18, monthly: 5, weekly: 9, yearly: 2 },
  { daily: 14, monthly: 3, weekly: 7, yearly: 1 },
  { daily: 11, monthly: 2, weekly: 5, yearly: 0 },
  { daily: 9, monthly: 1, weekly: 4, yearly: 0 },
  { daily: 7, monthly: 1, weekly: 3, yearly: 0 },
  { daily: 6, monthly: 0, weekly: 3, yearly: 0 },
  { daily: 5, monthly: 0, weekly: 2, yearly: 0 },
  { daily: 4, monthly: 0, weekly: 2, yearly: 0 },
  { daily: 3, monthly: 0, weekly: 1, yearly: 0 },
  { daily: 2, monthly: 0, weekly: 1, yearly: 0 }
] as const;

export const categoryLeaderboards: readonly CategoryLeaderboard[] = goalCategories.map(
  (goal) => ({
    goal,
    rows: aliasesByGoal[goal].map((alias, index) => ({
      alias,
      categoryEntries: Math.max(goal, goal * 12 - index * goal),
      rank: index + 1,
      streaks: previewStreaks[index],
      verifiedDays: Math.max(goal * 4, goal * 4 - Math.floor(index / 2))
    }))
  })
);

export function getCategoryLeaderboard(goal: GoalCategory) {
  const leaderboard = categoryLeaderboards.find((category) => category.goal === goal);

  if (!leaderboard) {
    throw new Error(`Missing leaderboard preview for ${goal}-day category.`);
  }

  return leaderboard;
}
