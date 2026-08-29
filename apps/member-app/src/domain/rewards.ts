import type { StreakCounts } from '@/domain/streaks';
import type { CategoryLeaderboard } from '@/domain/leaderboard';

export type RewardType = 'cash' | 'coupon' | 'physical';

export type RewardCatalogItem = {
  availableFrom: string | null;
  availableUntil: string | null;
  cashAmountCents: number | null;
  cashCurrency: string | null;
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
  regionTimezone: string;
  rewardType: RewardType;
  sponsorName: string;
  termsUrl: string | null;
  title: string;
};

export type RewardAward = {
  awardRank: number;
  awardedAt: string;
  cashAmountCents: number | null;
  cashCurrency: string | null;
  claimedAt: string | null;
  fulfilledAt: string | null;
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
  cashAmountCents: number | null;
  cashCurrency: string | null;
  prizeDrawEntries: number;
  rewardTitle: string;
  rewardType: RewardType;
  sponsorName: string;
  streaks: StreakCounts;
};

export type ParticipantCompetitionResults = {
  competitionName: string;
  monthKey: string;
  rewardCount: number;
  categoryLeaderboards: readonly CategoryLeaderboard[];
  competitionId: string;
  endedAt: string;
  participantGoalDays: number;
  regionCode: string;
  regionName: string;
  resultsStatus: 'pending' | 'settled';
  rewardWinners: readonly RewardWinner[];
  settledAt: string | null;
};

export function rewardAvailabilityLabel(reward: RewardCatalogItem): string {
  if (reward.inventoryRemaining === 0) return 'FULLY AWARDED';
  if (reward.inventoryRemaining === 1) return '1 AVAILABLE';
  return `${reward.inventoryRemaining.toLocaleString()} AVAILABLE`;
}

export function rewardTypeLabel(rewardType: RewardType): string {
  if (rewardType === 'cash') return 'CASH PRIZE';
  if (rewardType === 'coupon') return 'COUPON CODE';
  return 'PHYSICAL PRIZE';
}

export function rewardAvailabilityWindowLabel(
  reward: RewardCatalogItem
): string {
  if (!reward.availableFrom && !reward.availableUntil) {
    return 'AVAILABLE DURING THIS CONTEST';
  }

  const format = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeZone: reward.regionTimezone
  });
  if (reward.availableFrom && reward.availableUntil) {
    return `AVAILABLE ${format.format(new Date(reward.availableFrom))} – ${format.format(new Date(reward.availableUntil))}`;
  }
  if (reward.availableFrom) {
    return `AVAILABLE FROM ${format.format(new Date(reward.availableFrom))}`;
  }
  return `AVAILABLE UNTIL ${format.format(new Date(reward.availableUntil!))}`;
}
