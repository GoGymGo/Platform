import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getVisibleStreakUnits } from '@/domain/streakBadges';

describe('visible streak badges', () => {
  it('shows one day for one verified consecutive workout day', () => {
    assert.deepEqual(
      getVisibleStreakUnits({
        daily: 1,
        monthly: 1,
        projectionVersion: 'streaks-v1',
        weekly: 1,
        yearly: 1
      }),
      [{ count: 1, key: 'daily' }]
    );
  });

  it('shows only a day badge for a streak shorter than one week', () => {
    assert.deepEqual(
      getVisibleStreakUnits({
        daily: 5,
        monthly: 0,
        projectionVersion: 'streaks-v1',
        weekly: 0,
        yearly: 0
      }),
      [{ count: 5, key: 'daily' }]
    );
  });

  it('shows one month and three days for a 33-day streak', () => {
    assert.deepEqual(
      getVisibleStreakUnits({
        daily: 33,
        monthly: 1,
        projectionVersion: 'streaks-v1',
        weekly: 4,
        yearly: 0
      }),
      [
        { count: 1, key: 'monthly' },
        { count: 3, key: 'daily' }
      ]
    );
  });

  it('never returns more than two badges', () => {
    assert.deepEqual(
      getVisibleStreakUnits({
          daily: 409,
          monthly: 13,
          projectionVersion: 'streaks-v1',
          weekly: 58,
          yearly: 1
        },
        99
      ),
      [
        { count: 1, key: 'yearly' },
        { count: 1, key: 'monthly' }
      ]
    );
  });

  it('hides every compact badge for an authoritative zero projection', () => {
    assert.deepEqual(
      getVisibleStreakUnits({
        daily: 0,
        monthly: 0,
        projectionVersion: 'streaks-v1',
        weekly: 0,
        yearly: 0
      }),
      []
    );
  });

  it('does not turn calendar-period activity into a duration badge when the daily streak is inactive', () => {
    assert.deepEqual(
      getVisibleStreakUnits({
        daily: 0,
        monthly: 1,
        projectionVersion: 'streaks-v1',
        weekly: 0,
        yearly: 1
      }),
      []
    );
  });
});
