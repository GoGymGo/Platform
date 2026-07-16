import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getVisibleStreakUnits } from '@/domain/streakBadges';

describe('visible streak badges', () => {
  it('shows only a day badge for a streak shorter than one week', () => {
    assert.deepEqual(
      getVisibleStreakUnits({ daily: 5, monthly: 0, weekly: 0, yearly: 0 }),
      [{ count: 5, key: 'daily' }]
    );
  });

  it('shows one month and three days for a 33-day streak', () => {
    assert.deepEqual(
      getVisibleStreakUnits({ daily: 33, monthly: 1, weekly: 4, yearly: 0 }),
      [
        { count: 1, key: 'monthly' },
        { count: 3, key: 'daily' }
      ]
    );
  });

  it('never returns more than two badges', () => {
    assert.deepEqual(
      getVisibleStreakUnits({ daily: 409, monthly: 13, weekly: 58, yearly: 1 }),
      [
        { count: 1, key: 'yearly' },
        { count: 1, key: 'monthly' }
      ]
    );
  });
});
