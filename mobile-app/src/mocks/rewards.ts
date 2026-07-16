import type {
  RewardAward,
  RewardCatalogItem,
  RewardWinner,
  SettledCompetitionSummary
} from '@/domain/rewards';

export const rewardCatalogPreview: readonly RewardCatalogItem[] = [
  {
    competitionId: '10000000-0000-4000-8000-000000000101',
    competitionName: 'Victoria Summer Streak',
    description: 'A compact gym bag with an insulated bottle and recovery towel.',
    id: '20000000-0000-4000-8000-000000000101',
    imageUrl: null,
    inventoryRemaining: 12,
    inventoryTotal: 12,
    monthKey: '2026-08',
    regionCode: 'victoria-bc',
    regionName: 'Victoria',
    rewardType: 'physical',
    sponsorName: 'PACIFIC MOTION',
    termsUrl: null,
    title: 'TRAINING KIT'
  },
  {
    competitionId: '10000000-0000-4000-8000-000000000101',
    competitionName: 'Victoria Summer Streak',
    description: 'A one-time coupon for locally made protein and recovery products.',
    id: '20000000-0000-4000-8000-000000000102',
    imageUrl: null,
    inventoryRemaining: 40,
    inventoryTotal: 40,
    monthKey: '2026-08',
    regionCode: 'victoria-bc',
    regionName: 'Victoria',
    rewardType: 'coupon',
    sponsorName: 'ISLAND FUEL',
    termsUrl: null,
    title: '25% OFF RECOVERY FUEL'
  },
  {
    competitionId: '10000000-0000-4000-8000-000000000101',
    competitionName: 'Victoria Summer Streak',
    description: 'A limited-edition performance hoodie for verified contest winners.',
    id: '20000000-0000-4000-8000-000000000103',
    imageUrl: null,
    inventoryRemaining: 5,
    inventoryTotal: 5,
    monthKey: '2026-08',
    regionCode: 'victoria-bc',
    regionName: 'Victoria',
    rewardType: 'physical',
    sponsorName: 'NORTHLINE',
    termsUrl: null,
    title: 'PERFORMANCE HOODIE'
  }
];

export const rewardAwardsPreview: readonly RewardAward[] = [
  {
    awardRank: 2,
    awardedAt: '2026-07-31T19:00:00.000Z',
    claimedAt: null,
    id: '30000000-0000-4000-8000-000000000102',
    imageUrl: null,
    rewardType: 'coupon',
    sponsorName: 'ISLAND FUEL',
    status: 'awarded',
    title: '25% OFF RECOVERY FUEL'
  }
];

export const rewardWinnersPreview: readonly RewardWinner[] = [
  {
    alias: 'NEONVIPER',
    awardRank: 1,
    rewardTitle: 'TRAINING KIT',
    rewardType: 'physical',
    sponsorName: 'PACIFIC MOTION',
    streaks: { daily: 18, monthly: 5, weekly: 9, yearly: 2 }
  },
  {
    alias: 'CORE_FOUR',
    awardRank: 2,
    rewardTitle: '25% OFF RECOVERY FUEL',
    rewardType: 'coupon',
    sponsorName: 'ISLAND FUEL',
    streaks: { daily: 9, monthly: 1, weekly: 4, yearly: 0 }
  }
];

export const settledCompetitionPreview: SettledCompetitionSummary = {
  competitionName: 'Victoria Summer Streak',
  monthKey: '2026-07',
  rewardCount: 57
};
