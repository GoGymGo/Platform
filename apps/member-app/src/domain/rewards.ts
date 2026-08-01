import type { StreakCounts } from '@/domain/streaks';
export type RewardType = 'coupon' | 'physical';

export type RewardCatalogItem = {
  competitionId: string;
  competitionName: string;
  description: string;
  id: string;
  imageUrl: string | null;
  inventoryRemaining: number;
  inventoryTotal: number;
  monthKey: string;
  regionCode: string;
  regionName: string;
  rewardType: RewardType;
  sponsorName: string;
  termsUrl: string | null;
  title: string;
};

export type RewardAward = {
  awardRank: number;
  awardedAt: string;
  claimedAt: string | null;
  id: string;
  imageUrl: string | null;
  rewardType: RewardType;
  sponsorName: string;
  status: 'awarded' | 'cancelled' | 'claimed' | 'fulfilled' | 'redeemed';
  title: string;
};

export type ClaimedReward = RewardAward & {
  claimUrl: string | null;
  couponCode: string | null;
  fulfillmentInstructions: string | null;
};

export type RewardWinner = {
  alias: string;
  awardRank: number;
  rewardTitle: string;
  rewardType: RewardType;
  sponsorName: string;
  streaks: StreakCounts;
};

export type SettledCompetitionSummary = {
  competitionName: string;
  monthKey: string;
  rewardCount: number;
};

export function rewardAvailabilityLabel(reward: RewardCatalogItem): string {
  if (reward.inventoryRemaining === 0) return 'FULLY AWARDED';
  if (reward.inventoryRemaining === 1) return '1 AVAILABLE';
  return `${reward.inventoryRemaining.toLocaleString()} AVAILABLE`;
}
