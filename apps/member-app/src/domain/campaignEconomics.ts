export type GoalCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CategoryPodiumRank = 1 | 2 | 3;
export type WeeklyMatchMultiplier = 0 | 1 | 2 | 3;

export type VerifiedUsersByGoal = Record<GoalCategory, number>;

export type CampaignEconomicsSettings = {
  categoryPodiumMultipliers: CategoryPodiumMultipliers;
  rewardWinnerRate: number;
};

export type CategoryPodiumMultipliers = Record<CategoryPodiumRank, number>;

export type PrizeDrawWeightSettings = {
  categoryPodiumMultipliers: CategoryPodiumMultipliers;
};

export type CampaignEconomicsResult = {
  projectedRewardWinners: number;
  totalVerifiedUsers: number;
};

export type PrizeDrawWeightResult = {
  activeEntries: number;
  categoryAdjustedPeriodEntries: number;
  categoryRank: CategoryPodiumRank | null;
  drawWeight: number;
  multiplier: number;
};

export type PrizeDrawWeightInput = {
  bonusDayEntries: number;
  perfectMonthMultiplier: 1 | 10;
  periodEntriesBeforePerfectMonth: number;
  signupEntries: number;
};

export const goalCategories = [1, 2, 3, 4, 5, 6, 7] as const;

export function calculateWeeklyMatchEntries(
  weeklyGoal: number,
  weeklyMultipliers: readonly WeeklyMatchMultiplier[]
) {
  const goal = Math.min(7, Math.max(1, Math.round(weeklyGoal)));
  return weeklyMultipliers.map((multiplier) => goal * multiplier);
}

export function calculateCampaignEconomics(
  verifiedUsersByGoal: VerifiedUsersByGoal,
  settings: CampaignEconomicsSettings
): CampaignEconomicsResult {
  validateSettings(settings);
  const totalVerifiedUsers = goalCategories.reduce(
    (total, goal) => total + sanitizeCount(verifiedUsersByGoal[goal]),
    0
  );
  return {
    projectedRewardWinners:
      totalVerifiedUsers > 0
        ? Math.max(1, Math.floor(totalVerifiedUsers * settings.rewardWinnerRate))
        : 0,
    totalVerifiedUsers
  };
}

export function calculateFinalPrizeDrawWeight(
  input: PrizeDrawWeightInput,
  categoryRank: number | null,
  settings: PrizeDrawWeightSettings
): PrizeDrawWeightResult {
  validateCategoryPodiumMultipliers(settings.categoryPodiumMultipliers);
  const periodEntries = sanitizeCount(input.periodEntriesBeforePerfectMonth);
  const bonusDayEntries = sanitizeCount(input.bonusDayEntries);
  const signupEntries = sanitizeCount(input.signupEntries);
  const podiumRank = isCategoryPodiumRank(categoryRank) ? categoryRank : null;
  const multiplier = podiumRank ? settings.categoryPodiumMultipliers[podiumRank] : 1;
  const categoryAdjustedPeriodEntries = Math.floor(periodEntries * multiplier);
  const activeEntries =
    (periodEntries + bonusDayEntries) * input.perfectMonthMultiplier + signupEntries;

  return {
    activeEntries,
    categoryAdjustedPeriodEntries,
    categoryRank: podiumRank,
    drawWeight:
      (categoryAdjustedPeriodEntries + bonusDayEntries) * input.perfectMonthMultiplier +
      signupEntries,
    multiplier
  };
}

export function hasActivePrizeDrawEntry(entryCount: number) {
  return sanitizeCount(entryCount) > 0;
}

function validateSettings(settings: CampaignEconomicsSettings) {
  if (settings.rewardWinnerRate <= 0 || settings.rewardWinnerRate > 1) {
    throw new Error('Reward winner rate must be greater than 0 and at most 1.');
  }
  validateCategoryPodiumMultipliers(settings.categoryPodiumMultipliers);
}

function validateCategoryPodiumMultipliers(
  multipliers: CategoryPodiumMultipliers
) {
  const first = multipliers[1];
  const second = multipliers[2];
  const third = multipliers[3];
  if (
    ![first, second, third].every(Number.isFinite) ||
    first <= second ||
    second <= third ||
    third <= 1
  ) {
    throw new Error('Category podium multipliers must descend by rank and remain above 1x.');
  }
}

function isCategoryPodiumRank(rank: number | null): rank is CategoryPodiumRank {
  return rank === 1 || rank === 2 || rank === 3;
}

function sanitizeCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}
