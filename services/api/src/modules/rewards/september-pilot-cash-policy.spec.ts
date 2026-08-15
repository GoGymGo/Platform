import {
  isApprovedPublicAssetUrl,
  isSeptemberPilotCompetition,
  requireSeptemberPilotRewardApproval,
  septemberPilotCashReward,
  septemberPilotCompetition,
  septemberPilotRewardApprovalSha256,
  septemberPilotRewardConfigurationErrors,
  type SeptemberPilotCashRewardConfiguration,
} from './september-pilot-cash-policy';

const approvedReward = {
  cashAmountCents: septemberPilotCashReward.amountCents,
  cashCurrency: septemberPilotCashReward.currency,
  claimUrl: null,
  fulfillmentInstructions:
    'Record only an already-completed in-person cash handoff.',
  imageUrl: 'https://gogymgo.com/rewards/september-cash.png',
  inventoryTotal: septemberPilotCashReward.inventoryTotal,
  rewardType: septemberPilotCashReward.rewardType,
  sponsorName: septemberPilotCashReward.sponsorName,
  termsUrl: 'https://gogymgo.com/legal/official-contest-rules',
  title: septemberPilotCashReward.title,
} satisfies SeptemberPilotCashRewardConfiguration;

describe('September pilot cash policy', () => {
  it('recognizes only the exact competition identity', () => {
    expect(isSeptemberPilotCompetition(septemberPilotCompetition)).toBe(true);
    expect(
      isSeptemberPilotCompetition({
        ...septemberPilotCompetition,
        name: 'September cash demo',
      }),
    ).toBe(false);
  });

  it('requires the exact one-slot $100 CAD GoGymGo manual reward', () => {
    expect(septemberPilotRewardConfigurationErrors(approvedReward)).toEqual([]);
    expect(
      septemberPilotRewardConfigurationErrors({
        ...approvedReward,
        cashAmountCents: 9_999,
        cashCurrency: 'USD',
        claimUrl: 'https://payments.invalid/claim',
        inventoryTotal: 2,
        sponsorName: 'Provider',
      }),
    ).toEqual(
      expect.arrayContaining([
        'sponsor must be GoGymGo',
        'cash amount must be exactly 10000 cents',
        'cash currency must be CAD',
        'inventory must be exactly one',
        'cash reward cannot define a payment or claim URL',
      ]),
    );
  });

  it('rejects placeholder, credential-bearing, non-HTTPS, and malformed assets', () => {
    for (const url of [
      undefined,
      'http://gogymgo.com/reward.png',
      'https://example.com/reward.png',
      'https://admin:secret@gogymgo.com/reward.png',
      'https://gogymgo.com/reward.png#draft',
      'not-a-url',
    ]) {
      expect(isApprovedPublicAssetUrl(url)).toBe(false);
    }
    expect(isApprovedPublicAssetUrl(approvedReward.imageUrl)).toBe(true);
  });

  it('binds approval to the complete immutable public reward configuration', () => {
    const approval = septemberPilotRewardApprovalSha256(approvedReward);
    expect(requireSeptemberPilotRewardApproval(approvedReward, approval)).toBe(
      approval,
    );
    expect(() =>
      requireSeptemberPilotRewardApproval(
        { ...approvedReward, termsUrl: 'https://gogymgo.com/legal/changed' },
        approval,
      ),
    ).toThrow(/CONFIRM_PILOT_REWARD_APPROVAL_SHA256/);
    expect(() =>
      requireSeptemberPilotRewardApproval(approvedReward, undefined),
    ).toThrow(/owner and counsel approval/);
  });
});
