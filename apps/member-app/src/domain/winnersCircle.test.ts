import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCompetitionMonth,
  getWinnersCirclePresentationKey,
  isWinnersBannerVisible,
  shouldAutoPresentWinnersCircle
} from './winnersCircle';

describe('Winners Circle presentation', () => {
  it('opens each pending or settled result state once', () => {
    const pending = getWinnersCirclePresentationKey({
      competitionId: 'contest-1',
      resultsStatus: 'pending'
    });
    const settled = getWinnersCirclePresentationKey({
      competitionId: 'contest-1',
      resultsStatus: 'settled'
    });

    assert.equal(shouldAutoPresentWinnersCircle(pending, null), true);
    assert.equal(shouldAutoPresentWinnersCircle(pending, pending), false);
    assert.equal(shouldAutoPresentWinnersCircle(settled, pending), true);
    assert.equal(shouldAutoPresentWinnersCircle(null, pending), false);
  });

  it('formats the completed month for the winner announcement', () => {
    assert.equal(formatCompetitionMonth('2026-07'), 'July 2026');
  });

  it('shows the last-contest winners banner for exactly seven days after the contest ends', () => {
    const endedAt = '2026-07-31T07:00:00.000Z';
    const endedAtTime = Date.parse(endedAt);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    assert.equal(isWinnersBannerVisible(endedAt, endedAtTime - 1), false);
    assert.equal(isWinnersBannerVisible(endedAt, endedAtTime), true);
    assert.equal(isWinnersBannerVisible(endedAt, endedAtTime + sevenDays - 1), true);
    assert.equal(isWinnersBannerVisible(endedAt, endedAtTime + sevenDays), false);
    assert.equal(isWinnersBannerVisible('not-a-date', endedAtTime), false);
  });
});
