import {
  goalCategories,
  type GoalCategory,
  type RankedPrizeDrawPayout
} from '@/domain/campaignEconomics';

export type CategoryLeaderboardRow = {
  alias: string;
  categoryEntries: number;
  rank: number;
  verifiedDays: number;
};

export type CategoryLeaderboard = {
  goal: GoalCategory;
  rows: readonly CategoryLeaderboardRow[];
};

export type PayoutWinner = {
  alias: string;
  amount: number;
  payoutRank: number;
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

const payoutAliases = [
  'NEONVIPER',
  'CORE_FOUR',
  'SIX_SHIFT',
  'LUNA_3',
  'MAX_SEVEN',
  'DUO_FIT',
  'VOLT_5',
  'NOVA_6',
  'TRI_PULSE',
  'ACE_ONE'
] as const;

export const completedCompetitionPreview = {
  payoutExponent: 0.5,
  payoutPoolAmount: 20_000,
  payoutWinnerCount: 1_500
} as const;

export const categoryLeaderboards: readonly CategoryLeaderboard[] = goalCategories.map(
  (goal) => ({
    goal,
    rows: aliasesByGoal[goal].map((alias, index) => ({
      alias,
      categoryEntries: Math.max(goal, goal * 12 - index * goal),
      rank: index + 1,
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

export function buildPayoutWinnerPreview(
  payouts: readonly RankedPrizeDrawPayout[]
): readonly PayoutWinner[] {
  return payouts.slice(0, payoutAliases.length).map((payout, index) => ({
    alias: payoutAliases[index],
    amount: payout.amount,
    payoutRank: payout.payoutRank
  }));
}
