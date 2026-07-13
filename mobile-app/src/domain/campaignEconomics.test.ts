import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateCampaignEconomics,
  calculateFinalPrizeDrawWeight,
  calculateWeeklyMatchEntries,
  calculateRankedPrizeDrawPayouts,
  hasActivePrizeDrawEntry,
  type CampaignEconomicsSettings,
  type VerifiedUsersByGoal
} from './campaignEconomics';

const settings: CampaignEconomicsSettings = {
  categoryPodiumMultipliers: {
    1: 3,
    2: 2,
    3: 1.5
  },
  creatorPayoutPerVerifiedUser: 0.05,
  goGymGoPerVerifiedUser: 0.95,
  prizeDrawPayoutExponent: 0.5,
  prizeDrawPerVerifiedUser: 2,
  prizeDrawWinnerRate: 0.15,
  sponsorPerVerifiedUser: 3
};

describe('regional sponsor campaign economics', () => {
  it('calculates each weekly match result independently', () => {
    const weeklyEntries = calculateWeeklyMatchEntries(4, [1, 2, 3, 0]);

    assert.deepEqual(weeklyEntries, [4, 8, 12, 0]);
    assert.equal(weeklyEntries.reduce((total, entries) => total + entries, 0), 24);
  });
  it('allocates the complete $3 per verified user without category cash pools', () => {
    const result = calculateCampaignEconomics(projectedUsers, settings);

    assert.equal(result.totalVerifiedUsers, 10_000);
    assert.equal(result.sponsorContributionAmount, 30_000);
    assert.equal(result.prizeDrawAmount, 20_000);
    assert.equal(result.creatorPayoutAmount, 500);
    assert.equal(result.goGymGoAmount, 9_500);
  });

  it('selects floor 15% with a minimum of one and pays a descending ladder', () => {
    const result = calculateCampaignEconomics(
      { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0, 6: 0, 7: 0 },
      settings
    );

    assert.equal(result.prizeDrawWinnerCount, 3);
    assert.equal(result.prizeDrawAmount, 50);
    assert.equal(result.prizeDrawTopPayout, 21.89);
    assert.equal(result.prizeDrawMinimumPayout, 12.63);
    assert.equal(result.prizeDrawAveragePayout, 50 / 3);
  });

  it('projects a flatter poker-style ladder for 10,000 verified players', () => {
    const result = calculateCampaignEconomics(projectedUsers, settings);

    assert.equal(result.prizeDrawWinnerCount, 1_500);
    assert.equal(result.prizeDrawTopPayout, 263.12);
    assert.equal(result.prizeDrawMinimumPayout, 6.79);
    assert.equal(result.prizeDrawAveragePayout, 20_000 / 1_500);
  });

  it('allocates the complete pool to the cent in non-increasing draw order', () => {
    const payouts = calculateRankedPrizeDrawPayouts(20_000, 1_500, 0.5);

    assert.equal(payouts.length, 1_500);
    assert.equal(
      payouts.reduce((total, payout) => total + payout.amountCents, 0),
      2_000_000
    );
    assert.equal(payouts[0].payoutRank, 1);
    assert.equal(payouts.at(-1)?.payoutRank, 1_500);
    assert.ok(payouts.every((payout, index) => index === 0 || payouts[index - 1].amountCents >= payout.amountCents));
    assert.ok(payouts[0].poolShare < 0.02);
    assert.ok((payouts.at(-1)?.amountCents ?? 0) > 0);
  });

  it('applies every match and category scenario before the final perfect-month multiplier', () => {
    const fourDayMatchedPerfectMonth = {
      bonusDayEntries: 0,
      perfectMonthMultiplier: 10 as const,
      periodEntriesBeforePerfectMonth: 32,
      signupEntries: 0
    };

    assert.deepEqual(calculateFinalPrizeDrawWeight(fourDayMatchedPerfectMonth, 1, settings), {
      activeEntries: 320,
      categoryAdjustedPeriodEntries: 96,
      categoryRank: 1,
      drawWeight: 960,
      multiplier: 3
    });
    assert.equal(calculateFinalPrizeDrawWeight(fourDayMatchedPerfectMonth, 2, settings).drawWeight, 640);
    assert.equal(calculateFinalPrizeDrawWeight(fourDayMatchedPerfectMonth, 3, settings).drawWeight, 480);
    assert.equal(calculateFinalPrizeDrawWeight(fourDayMatchedPerfectMonth, 4, settings).drawWeight, 320);

    const matchScenarios = [
      { periodEntries: 16, expected: [480, 320, 240, 160] },
      { periodEntries: 32, expected: [960, 640, 480, 320] },
      { periodEntries: 48, expected: [1440, 960, 720, 480] }
    ] as const;

    for (const scenario of matchScenarios) {
      for (const [index, rank] of [1, 2, 3, 4].entries()) {
        assert.equal(
          calculateFinalPrizeDrawWeight(
            {
              ...fourDayMatchedPerfectMonth,
              periodEntriesBeforePerfectMonth: scenario.periodEntries
            },
            rank,
            settings
          ).drawWeight,
          scenario.expected[index]
        );
      }
    }

    assert.equal(
      calculateFinalPrizeDrawWeight(
        { ...fourDayMatchedPerfectMonth, bonusDayEntries: 12, signupEntries: 1 },
        1,
        settings
      ).drawWeight,
      1081
    );

    const sevenDayMaximumMatchEntries = calculateWeeklyMatchEntries(
      7,
      [3, 3, 3, 3]
    ).reduce((total, entries) => total + entries, 0);
    assert.equal(
      calculateFinalPrizeDrawWeight(
        {
          bonusDayEntries: 21,
          perfectMonthMultiplier: 10,
          periodEntriesBeforePerfectMonth: sevenDayMaximumMatchEntries,
          signupEntries: 0
        },
        1,
        settings
      ).drawWeight,
      2730
    );
  });

  it('makes the signup entry active as soon as it is issued', () => {
    assert.equal(hasActivePrizeDrawEntry(0), false);
    assert.equal(hasActivePrizeDrawEntry(1), true);
  });

  it('rejects campaign settings whose allocations do not equal the sponsor rate', () => {
    assert.throws(
      () =>
        calculateCampaignEconomics(projectedUsers, {
          ...settings,
          goGymGoPerVerifiedUser: 1
        }),
      /allocations must equal/i
    );
  });

  it('rejects podium multipliers that do not descend by rank', () => {
    assert.throws(
      () =>
        calculateCampaignEconomics(projectedUsers, {
          ...settings,
          categoryPodiumMultipliers: { 1: 2, 2: 2, 3: 1.5 }
        }),
      /podium multipliers/i
    );
  });

  it('rejects payout curves outside the adjustable flat-to-steep range', () => {
    assert.throws(
      () => calculateRankedPrizeDrawPayouts(100, 10, 0),
      /payout exponent/i
    );
    assert.throws(
      () => calculateRankedPrizeDrawPayouts(100, 10, 1.1),
      /payout exponent/i
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
