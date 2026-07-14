export type GoalCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CategoryPodiumRank = 1 | 2 | 3;
export type WeeklyMatchMultiplier = 0 | 1 | 2 | 3;

export type VerifiedUsersByGoal = Record<GoalCategory, number>;

export type CampaignEconomicsSettings = {
  categoryPodiumMultipliers: Record<CategoryPodiumRank, number>;
  creatorPayoutPerVerifiedUser: number;
  goGymGoPerVerifiedUser: number;
  prizeDrawPayoutExponent: number;
  prizeDrawPerVerifiedUser: number;
  prizeDrawWinnerRate: number;
  sponsorPerVerifiedUser: number;
};

export type CampaignEconomicsResult = {
  creatorPayoutAmount: number;
  goGymGoAmount: number;
  prizeDrawAmount: number;
  prizeDrawAveragePayout: number;
  prizeDrawMinimumPayout: number;
  prizeDrawTopPayout: number;
  prizeDrawWinnerCount: number;
  sponsorContributionAmount: number;
  totalVerifiedUsers: number;
};

export type RankedPrizeDrawPayout = {
  amount: number;
  amountCents: number;
  payoutRank: number;
  poolShare: number;
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

export const categoryRankTieBreakOrder = [
  'CATEGORY SCORE',
  'LONGEST VERIFIED WORKOUT STREAK',
  'MOST VERIFIED COMPETITION DAYS',
  'AUDITED EQUAL-CHANCE TIE-BREAK'
] as const;

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
  const sponsorContributionCents =
    toPerUserCents(settings.sponsorPerVerifiedUser) * totalVerifiedUsers;
  const prizeDrawCents =
    toPerUserCents(settings.prizeDrawPerVerifiedUser) * totalVerifiedUsers;
  const creatorPayoutCents =
    toPerUserCents(settings.creatorPayoutPerVerifiedUser) * totalVerifiedUsers;
  const goGymGoCents =
    toPerUserCents(settings.goGymGoPerVerifiedUser) * totalVerifiedUsers;

  if (prizeDrawCents + creatorPayoutCents + goGymGoCents !== sponsorContributionCents) {
    throw new Error('Campaign allocations must equal the sponsor contribution.');
  }

  const prizeDrawWinnerCount =
    totalVerifiedUsers > 0
      ? Math.max(1, Math.floor(totalVerifiedUsers * settings.prizeDrawWinnerRate))
      : 0;
  const rankedPayouts = calculateRankedPrizeDrawPayouts(
    centsToAmount(prizeDrawCents),
    prizeDrawWinnerCount,
    settings.prizeDrawPayoutExponent
  );

  return {
    creatorPayoutAmount: centsToAmount(creatorPayoutCents),
    goGymGoAmount: centsToAmount(goGymGoCents),
    prizeDrawAmount: centsToAmount(prizeDrawCents),
    prizeDrawAveragePayout:
      prizeDrawWinnerCount > 0
        ? centsToAmount(prizeDrawCents) / prizeDrawWinnerCount
        : 0,
    prizeDrawMinimumPayout: rankedPayouts.at(-1)?.amount ?? 0,
    prizeDrawTopPayout: rankedPayouts[0]?.amount ?? 0,
    prizeDrawWinnerCount,
    sponsorContributionAmount: centsToAmount(sponsorContributionCents),
    totalVerifiedUsers
  };
}

export function calculateRankedPrizeDrawPayouts(
  poolAmount: number,
  winnerCount: number,
  exponent: number
): readonly RankedPrizeDrawPayout[] {
  validatePayoutExponent(exponent);

  const poolCents = Number.isFinite(poolAmount)
    ? Math.max(0, Math.round(poolAmount * 100))
    : 0;
  const count = sanitizeCount(winnerCount);

  if (poolCents === 0 || count === 0) {
    return [];
  }

  const weights = Array.from(
    { length: count },
    (_, index) => 1 / Math.pow(index + 1, exponent)
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const payoutCents = weights.map((weight) =>
    Math.floor((poolCents * weight) / totalWeight)
  );
  const allocatedCents = payoutCents.reduce((total, amount) => total + amount, 0);
  const remainderCents = poolCents - allocatedCents;

  // Earliest draw ranks receive residual cents so the ladder remains monotonic.
  for (let index = 0; index < remainderCents; index += 1) {
    payoutCents[index] += 1;
  }

  return payoutCents.map((amountCents, index) => ({
    amount: centsToAmount(amountCents),
    amountCents,
    payoutRank: index + 1,
    poolShare: amountCents / poolCents
  }));
}

export function calculateFinalPrizeDrawWeight(
  input: PrizeDrawWeightInput,
  categoryRank: number | null,
  settings: CampaignEconomicsSettings
): PrizeDrawWeightResult {
  const periodEntries = sanitizeCount(input.periodEntriesBeforePerfectMonth);
  const bonusDayEntries = sanitizeCount(input.bonusDayEntries);
  const signupEntries = sanitizeCount(input.signupEntries);
  const podiumRank = isCategoryPodiumRank(categoryRank) ? categoryRank : null;
  const multiplier = podiumRank ? settings.categoryPodiumMultipliers[podiumRank] : 1;
  const categoryAdjustedPeriodEntries = periodEntries * multiplier;
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
  const allocationCents =
    toPerUserCents(settings.prizeDrawPerVerifiedUser) +
    toPerUserCents(settings.creatorPayoutPerVerifiedUser) +
    toPerUserCents(settings.goGymGoPerVerifiedUser);

  if (allocationCents !== toPerUserCents(settings.sponsorPerVerifiedUser)) {
    throw new Error('Per-user campaign allocations must equal the sponsor rate.');
  }

  if (settings.prizeDrawWinnerRate <= 0 || settings.prizeDrawWinnerRate > 1) {
    throw new Error('Prize draw winner rate must be greater than 0 and at most 1.');
  }

  validatePayoutExponent(settings.prizeDrawPayoutExponent);

  const first = settings.categoryPodiumMultipliers[1];
  const second = settings.categoryPodiumMultipliers[2];
  const third = settings.categoryPodiumMultipliers[3];

  if (
    ![first, second, third].every(Number.isFinite) ||
    first <= second ||
    second <= third ||
    third <= 1
  ) {
    throw new Error('Category podium multipliers must descend by rank and remain above 1x.');
  }
}

function validatePayoutExponent(exponent: number) {
  if (!Number.isFinite(exponent) || exponent <= 0 || exponent > 1) {
    throw new Error('Prize draw payout exponent must be greater than 0 and at most 1.');
  }
}

function isCategoryPodiumRank(rank: number | null): rank is CategoryPodiumRank {
  return rank === 1 || rank === 2 || rank === 3;
}

function sanitizeCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function toPerUserCents(amount: number) {
  return Math.round(amount * 100);
}

function centsToAmount(cents: number) {
  return cents / 100;
}
