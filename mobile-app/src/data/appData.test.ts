import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAppDataSource } from '@/data/appData';
import type { ApiClient } from '@/services/api/client';

describe('app data boundary', () => {
  it('keeps demo fixtures available only in demo mode', async () => {
    const demo = createAppDataSource('demo');

    assert.ok((await demo.getCreatorWorkouts()).length > 0);
    assert.equal((await demo.getCategoryLeaderboard(4))?.rows.length, 10);
    assert.equal(await demo.getCompetitionEnrollmentCount('TORONTO', '2026-08'), 84);
    assert.notEqual(await demo.getSettledCompetition(), null);
  });

  it('returns honest empty data when production services are unavailable', async () => {
    const production = createAppDataSource('unavailable');

    assert.deepEqual(await production.getCreatorWorkouts(), []);
    assert.equal(await production.getCategoryLeaderboard(4), null);
    assert.deepEqual(await production.getCompetitionMatches('2026-08', 4, 'TORONTO'), []);
    assert.equal(await production.getCompetitionEnrollmentCount('TORONTO', '2026-08'), null);
    assert.equal(production.getSessionTelemetry(60), null);
    assert.equal(await production.getSettledCompetition(), null);
  });

  it('requires an authenticated API client for API mode', () => {
    assert.throws(
      () => createAppDataSource('api'),
      /requires a configured API client/i
    );
  });

  it('converts integer API payout amounts at the repository boundary', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve({
        amountMinor: 12_500,
        competitionLabel: 'JULY 2026 REGIONAL PRIZE DRAW',
        currency: 'CAD',
        id: 'payout-1',
        portalUrl: 'https://pay.example.com',
        provider: 'hyperwallet',
        status: 'action-required'
      }) as Promise<TResponse>
    };
    const production = createAppDataSource('api', api);

    assert.equal((await production.getCurrentUserPayout())?.amount, 125);
  });
});
