import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CampaignEconomicsSettings } from './campaignEconomics';
import {
  buildRemainderDayOptions,
  calculateMaximumCommitmentEntries,
  calculateMonthAwareCommitmentWeight,
  calculateRemainderDayEntries,
  getCompetitionRemainderDayCount
} from './commitmentProjection';

const settings: CampaignEconomicsSettings = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  rewardWinnerRate: 0.15
};

const monthCases = [
  { monthKey: '2026-02', remainderDays: 0 },
  { monthKey: '2024-02', remainderDays: 1 },
  { monthKey: '2026-04', remainderDays: 2 },
  { monthKey: '2026-07', remainderDays: 3 }
] as const;

describe('month-aware commitment projections', () => {
  it('offers only remainder days that exist in the competition month', () => {
    for (const monthCase of monthCases) {
      assert.equal(
        getCompetitionRemainderDayCount(monthCase.monthKey),
        monthCase.remainderDays
      );
      assert.deepEqual(
        buildRemainderDayOptions(monthCase.monthKey).map((option) => option.value),
        Array.from({ length: monthCase.remainderDays + 1 }, (_, value) => value)
      );
    }
  });

  it('matches the maximum formula for every goal and calendar length', () => {
    for (const monthCase of monthCases) {
      for (let weeklyGoal = 1; weeklyGoal <= 7; weeklyGoal += 1) {
        const expected =
          (weeklyGoal * 3 * 4 * settings.categoryPodiumMultipliers[1] +
            monthCase.remainderDays * weeklyGoal) *
          10;

        assert.equal(
          calculateMaximumCommitmentEntries(
            weeklyGoal,
            monthCase.monthKey,
            settings
          ),
          expected,
          `${weeklyGoal} days in ${monthCase.monthKey}`
        );
      }
    }
  });

  it('calculates every legal calculator path in the correct order', () => {
    const weeklyResultSets = Array.from({ length: 4 ** 4 }, (_, index) => {
      let remaining = index;

      return Array.from({ length: 4 }, () => {
        const multiplier = (remaining % 4) as 0 | 1 | 2 | 3;
        remaining = Math.floor(remaining / 4);
        return multiplier;
      });
    });
    const categoryRanks = [null, 1, 2, 3] as const;

    for (const monthCase of monthCases) {
      for (let weeklyGoal = 1; weeklyGoal <= 7; weeklyGoal += 1) {
        for (const weeklyResults of weeklyResultSets) {
          const matchSubtotal = weeklyResults.reduce<number>(
            (total, multiplier) => total + weeklyGoal * multiplier,
            0
          );
          const perfectMonthOptions = weeklyResults.includes(0)
            ? ([1] as const)
            : ([1, 10] as const);

          for (const categoryRank of categoryRanks) {
            const categoryMultiplier = categoryRank === null
              ? 1
              : settings.categoryPodiumMultipliers[categoryRank];

            for (
              let remainderDays = 0;
              remainderDays <= monthCase.remainderDays;
              remainderDays += 1
            ) {
              for (const perfectMonthMultiplier of perfectMonthOptions) {
                const expected =
                  (matchSubtotal * categoryMultiplier + remainderDays * weeklyGoal) *
                  perfectMonthMultiplier;
                const actual = calculateMonthAwareCommitmentWeight(
                  {
                    perfectMonthMultiplier,
                    periodEntriesBeforePerfectMonth: matchSubtotal,
                    remainderDayCount: remainderDays,
                    weeklyGoal,
                    signupEntries: 0
                  },
                  categoryRank,
                  monthCase.monthKey,
                  settings
                ).drawWeight;

                assert.equal(
                  actual,
                  expected,
                  `${weeklyGoal} days, ${monthCase.monthKey}, weekly ${weeklyResults.join('/')}, rank ${categoryRank ?? 'none'}, ${remainderDays} remainder, ${perfectMonthMultiplier}x perfect month`
                );
              }
            }
          }
        }
      }
    }
  });

  it('clamps stale or invalid remainder-day selections to the month maximum', () => {
    assert.equal(calculateRemainderDayEntries(7, 3, '2026-04'), 14);
    assert.equal(
      calculateMonthAwareCommitmentWeight(
        {
          perfectMonthMultiplier: 10,
          periodEntriesBeforePerfectMonth: 84,
          remainderDayCount: 3,
          weeklyGoal: 7,
          signupEntries: 0
        },
        1,
        '2026-04',
        settings
      ).drawWeight,
      2660
    );
  });
});
