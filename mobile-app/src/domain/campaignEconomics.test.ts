import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateCampaignEconomics,
  calculateFinalPrizeDrawWeight,
  calculateWeeklyMatchEntries,
  hasActivePrizeDrawEntry,
  type CampaignEconomicsSettings,
  type VerifiedUsersByGoal
} from './campaignEconomics';

const settings: CampaignEconomicsSettings = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  rewardWinnerRate: 0.15
};

describe('regional brand-reward campaign projections', () => {
  it('calculates each weekly match result independently', () => {
    assert.deepEqual(calculateWeeklyMatchEntries(4, [1, 2, 3, 0]), [4, 8, 12, 0]);
  });

  it('projects reward inventory from verified users without cash calculations', () => {
    const result = calculateCampaignEconomics(projectedUsers, settings);
    assert.equal(result.totalVerifiedUsers, 10_000);
    assert.equal(result.projectedRewardWinners, 1_500);
    assert.deepEqual(Object.keys(result).sort(), [
      'projectedRewardWinners',
      'totalVerifiedUsers'
    ]);
  });

  it('applies category and perfect-month multipliers to draw weight', () => {
    const input = {
      bonusDayEntries: 12,
      perfectMonthMultiplier: 10 as const,
      periodEntriesBeforePerfectMonth: 32,
      signupEntries: 1
    };
    assert.deepEqual(calculateFinalPrizeDrawWeight(input, 1, settings), {
      activeEntries: 441,
      categoryAdjustedPeriodEntries: 96,
      categoryRank: 1,
      drawWeight: 1081,
      multiplier: 3
    });
  });

  it('makes the signup entry active as soon as it is issued', () => {
    assert.equal(hasActivePrizeDrawEntry(0), false);
    assert.equal(hasActivePrizeDrawEntry(1), true);
  });

  it('rejects invalid reward rates and podium ordering', () => {
    assert.throws(
      () => calculateCampaignEconomics(projectedUsers, { ...settings, rewardWinnerRate: 0 }),
      /reward winner rate/i
    );
    assert.throws(
      () => calculateCampaignEconomics(projectedUsers, {
        ...settings,
        categoryPodiumMultipliers: { 1: 2, 2: 2, 3: 1.5 }
      }),
      /podium multipliers/i
    );
  });
});

const projectedUsers: VerifiedUsersByGoal = {
  1: 800,
  2: 1_300,
  3: 1_700,
  4: 2_200,
  5: 1_700,
  6: 1_300,
  7: 1_000
};
