import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCompetitionMonth,
  getWinnersCirclePresentationKey,
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
});
