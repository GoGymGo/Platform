import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAppDataSource } from '@/data/appData';
import type { ApiClient } from '@/services/api/client';

describe('app data boundary', () => {
  it('returns honest empty data when production services are unavailable', async () => {
    const production = createAppDataSource(null);

    assert.equal(production.mode, 'unavailable');
    assert.deepEqual(await production.getCreatorWorkouts(), []);
    assert.equal(await production.getCategoryLeaderboard(4), null);
    assert.deepEqual(await production.getCompetitionMatches('2026-08', 4, 'TORONTO'), []);
    assert.equal(await production.getCompetitionEnrollmentCount('TORONTO', '2026-08'), null);
    assert.equal(await production.getSettledCompetition(), null);
  });

  it('converts integer API payout amounts at the repository boundary', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve({
        amountMinor: 12_500,
        competitionLabel: 'JULY 2026 REGIONAL PRIZE DRAW',
        currency: 'CAD',
        id: 'payout-1',
        provider: 'hyperwallet',
        status: 'action-required'
      }) as Promise<TResponse>
    };
    const production = createAppDataSource(api);

    assert.equal(production.mode, 'api');
    assert.equal((await production.getCurrentUserPayout())?.amount, 125);
  });
});
