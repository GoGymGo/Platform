import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCompetitionMonth,
  getPreviousCompetitionMonthKey,
  shouldAutoPresentWinnersCircle
} from './winnersCircle';

describe('Winners Circle presentation', () => {
  it('opens once on the first regional day of a login month', () => {
    assert.equal(shouldAutoPresentWinnersCircle('2026-08-01', null), true);
    assert.equal(shouldAutoPresentWinnersCircle('2026-08-01', '2026-08'), false);
    assert.equal(shouldAutoPresentWinnersCircle('2026-08-02', null), false);
  });

  it('resolves the completed competition month across a year boundary', () => {
    assert.equal(getPreviousCompetitionMonthKey('2026-08'), '2026-07');
    assert.equal(getPreviousCompetitionMonthKey('2026-01'), '2025-12');
  });

  it('formats the completed month for the winner announcement', () => {
    assert.equal(formatCompetitionMonth('2026-07'), 'July 2026');
  });
});
