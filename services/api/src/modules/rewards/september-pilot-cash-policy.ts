import { createHash } from 'node:crypto';
import { stableJson } from '../../common/idempotency/stable-json';

export const septemberPilotCompetition = {
  monthKey: '2026-09',
  name: 'GoGymGo September 2026 Island Pilot',
  regionCode: 'vancouver-island-gulf-islands-bc',
} as const;

export const septemberPilotCashReward = {
  amountCents: 10_000,
  currency: 'CAD',
  inventoryTotal: 1,
  rewardType: 'cash',
  sponsorName: 'GoGymGo',
  title: 'GoGymGo $100 CAD Cash Reward',
} as const;

export type SeptemberPilotCompetitionContext = {
  monthKey: string;
  name: string;
  regionCode: string;
};

export type SeptemberPilotCashRewardConfiguration = {
  cashAmountCents: number | null | undefined;
  cashCurrency: string | null | undefined;
  claimUrl: string | null | undefined;
  fulfillmentInstructions: string | null | undefined;
  imageUrl: string | null | undefined;
  inventoryTotal: number;
  rewardType: string;
  sponsorName: string;
  termsUrl: string | null | undefined;
  title: string;
};

export function isSeptemberPilotCompetition(
  competition: SeptemberPilotCompetitionContext,
): boolean {
  return (
    competition.monthKey === septemberPilotCompetition.monthKey &&
    competition.name === septemberPilotCompetition.name &&
    competition.regionCode === septemberPilotCompetition.regionCode
  );
}

export function septemberPilotRewardConfigurationErrors(
  reward: SeptemberPilotCashRewardConfiguration,
): string[] {
  const errors: string[] = [];
  if (reward.rewardType !== septemberPilotCashReward.rewardType) {
    errors.push('reward type must be cash');
  }
  if (reward.sponsorName.trim() !== septemberPilotCashReward.sponsorName) {
    errors.push('sponsor must be GoGymGo');
  }
  if (reward.title.trim() !== septemberPilotCashReward.title) {
    errors.push('title must identify the $100 CAD cash reward');
  }
  if (reward.cashAmountCents !== septemberPilotCashReward.amountCents) {
    errors.push('cash amount must be exactly 10000 cents');
  }
  if (
    reward.cashCurrency?.trim().toUpperCase() !==
    septemberPilotCashReward.currency
  ) {
    errors.push('cash currency must be CAD');
  }
  if (reward.inventoryTotal !== septemberPilotCashReward.inventoryTotal) {
    errors.push('inventory must be exactly one');
  }
  if (reward.claimUrl) {
    errors.push('cash reward cannot define a payment or claim URL');
  }
  if (!reward.fulfillmentInstructions?.trim()) {
    errors.push('manual in-person fulfillment instructions are required');
  }
  if (!isApprovedPublicAssetUrl(reward.imageUrl)) {
    errors.push('an approved non-placeholder HTTPS image URL is required');
  }
  if (!isApprovedPublicAssetUrl(reward.termsUrl)) {
    errors.push('an approved non-placeholder HTTPS terms URL is required');
  }
  return errors;
}

export function isApprovedPublicAssetUrl(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.localhost') &&
      hostname !== 'example.com' &&
      !hostname.endsWith('.example.com') &&
      hostname !== 'example.net' &&
      !hostname.endsWith('.example.net') &&
      hostname !== 'example.org' &&
      !hostname.endsWith('.example.org')
    );
  } catch {
    return false;
  }
}

export function septemberPilotRewardApprovalSha256(
  reward: SeptemberPilotCashRewardConfiguration,
): string {
  return createHash('sha256')
    .update(
      stableJson({
        cashAmountCents: reward.cashAmountCents ?? null,
        cashCurrency: reward.cashCurrency?.trim().toUpperCase() ?? null,
        claimUrl: reward.claimUrl ?? null,
        fulfillmentInstructions: reward.fulfillmentInstructions?.trim() ?? null,
        imageUrl: reward.imageUrl ?? null,
        inventoryTotal: reward.inventoryTotal,
        rewardType: reward.rewardType,
        sponsorName: reward.sponsorName.trim(),
        termsUrl: reward.termsUrl ?? null,
        title: reward.title.trim(),
      }),
    )
    .digest('hex');
}

export function requireSeptemberPilotRewardApproval(
  reward: SeptemberPilotCashRewardConfiguration,
  confirmation: string | undefined,
): string {
  const errors = septemberPilotRewardConfigurationErrors(reward);
  if (errors.length > 0) {
    throw new Error(`Pilot reward is not publishable: ${errors.join('; ')}.`);
  }
  const expected = septemberPilotRewardApprovalSha256(reward);
  if (confirmation?.trim().toLowerCase() !== expected) {
    throw new Error(
      'CONFIRM_PILOT_REWARD_APPROVAL_SHA256 must match the exact approved ' +
        `reward configuration (${expected}) after owner and counsel approval.`,
    );
  }
  return expected;
}
