import assert from 'node:assert/strict';
import test from 'node:test';

import {
  competitionEnrollmentRefreshQueryKeys,
  getCompetitionMatchRefetchInterval
} from './competitionMatchSync';

test('enrollment refreshes progress and every pairing view', () => {
  assert.deepEqual(competitionEnrollmentRefreshQueryKeys, [
    ['competition-progress'],
    ['competition-matches'],
    ['weekly-challenge-partners'],
    ['weekly-challenge-requests']
  ]);
});

test('searching matches refresh until the server assigns a partner', () => {
  assert.equal(getCompetitionMatchRefetchInterval(undefined), 5_000);
  assert.equal(getCompetitionMatchRefetchInterval([]), 5_000);
  assert.equal(
    getCompetitionMatchRefetchInterval([{ availability: 'searching' }]),
    5_000
  );
  assert.equal(
    getCompetitionMatchRefetchInterval([{ availability: 'matched' }]),
    false
  );
  assert.equal(
    getCompetitionMatchRefetchInterval([{ availability: 'solo' }]),
    false
  );
});
