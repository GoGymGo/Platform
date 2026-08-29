import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  competitionResultsRefetchMs,
  getCompetitionResultsRefetchInterval,
  getRewardAwardsRefetchInterval
} from './competitionResultsSync';

describe('competition result synchronization', () => {
  it('keeps checking while automatic settlement is pending and stops after publication', () => {
    assert.equal(getCompetitionResultsRefetchInterval(null), competitionResultsRefetchMs);
    assert.equal(
      getCompetitionResultsRefetchInterval({ resultsStatus: 'pending' }),
      competitionResultsRefetchMs
    );
    assert.equal(getCompetitionResultsRefetchInterval({ resultsStatus: 'settled' }), false);
  });

  it('keeps an empty Award screen live until an Award appears', () => {
    assert.equal(getRewardAwardsRefetchInterval([]), competitionResultsRefetchMs);
    assert.equal(getRewardAwardsRefetchInterval([{}]), false);
  });
});
