import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAppDataSource } from '@/data/appData';
import type { ApiClient, ApiRequestOptions } from '@/services/api/client';

describe('app data boundary', () => {
  it('returns honest empty data when services are unavailable', async () => {
    const unavailable = createAppDataSource('unavailable');

    assert.deepEqual(await unavailable.getCreatorWorkouts('vancouver-bc'), []);
    assert.deepEqual(await unavailable.getRewardCatalog('toronto'), []);
    assert.deepEqual(await unavailable.getMyRewardAwards(), []);
    assert.deepEqual(await unavailable.getRewardWinners(), []);
    assert.equal(await unavailable.getCategoryLeaderboard(4), null);
    assert.deepEqual(
      await unavailable.getCompetitionMatches('2026-08', 4, 'toronto-on'),
      []
    );
    assert.equal(
      await unavailable.getCompetitionEnrollmentCount('toronto-on', '2026-08'),
      null
    );
    assert.equal(await unavailable.getMyStreaks(), null);
    assert.equal(await unavailable.getSettledCompetition(), null);
    await assert.rejects(
      () => unavailable.planCreatorWorkout('workout-id', '2026-07-16'),
      /API is not configured/i
    );
  });

  it('requires an authenticated API client for API mode', () => {
    assert.throws(
      () => createAppDataSource('api'),
      /API client is unavailable/i
    );
  });

  it('loads the public reward marketplace for a region and contest month', async () => {
    let requestPath = '';
    let authenticated: boolean | undefined;
    const api: ApiClient = {
      request: <TResponse, TBody = never>(
        path: string,
        options?: ApiRequestOptions<TBody>
      ) => {
        requestPath = path;
        authenticated = options?.authenticated;
        return Promise.resolve([]) as Promise<TResponse>;
      }
    };
    const production = createAppDataSource('api', api);

    await production.getRewardCatalog('toronto', '2026-08');
    assert.equal(
      requestPath,
      '/v1/rewards/catalog?region=toronto&monthKey=2026-08'
    );
    assert.equal(authenticated, false);
  });

  it('loads streak rewards from the authenticated API boundary', async () => {
    let requestedPath = '';
    const api: ApiClient = {
      request: <TResponse>(path: string) => {
        requestedPath = path;
        return Promise.resolve({
          asOfDate: '2026-07-15',
          streaks: { daily: 3, monthly: 2, weekly: 4, yearly: 1 },
          timezone: 'America/Vancouver'
        }) as Promise<TResponse>;
      }
    };

    const streaks = await createAppDataSource('api', api).getMyStreaks();

    assert.equal(requestedPath, '/v1/streaks/me');
    assert.equal(streaks?.streaks.weekly, 4);
  });

});
