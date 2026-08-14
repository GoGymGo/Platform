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
    assert.equal(await unavailable.getMyLatestCompetitionResults(), null);
    assert.equal(await unavailable.getCategoryLeaderboard(4), null);
    assert.deepEqual(
      await unavailable.getCompetitionMatches('2026-08', 4, 'toronto-on'),
      []
    );
    assert.equal(
      await unavailable.getCompetitionEnrollmentCount(
        '40000000-0000-4000-8000-000000000001',
        'toronto-on',
        '2026-08'
      ),
      null
    );
    assert.equal(await unavailable.getMyStreaks(), null);
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

  it('pins Weekly Challenge matches to the authoritative enrolled contest', async () => {
    let requestedPath = '';
    const api: ApiClient = {
      request: <TResponse>(path: string) => {
        requestedPath = path;
        return Promise.resolve([]) as Promise<TResponse>;
      }
    };

    await createAppDataSource('api', api).getCompetitionMatches(
      '2026-08',
      1,
      'vancouver-bc',
      '40000000-0000-4000-8000-000000000001'
    );

    assert.equal(
      requestedPath,
      '/v1/competitions/2026-08/matches?goal=1&region=vancouver-bc' +
        '&competitionId=40000000-0000-4000-8000-000000000001'
    );
  });

  it('pins the public entrant count to one exact competition', async () => {
    let requestedPath = '';
    let authenticated: boolean | undefined;
    const api: ApiClient = {
      request: <TResponse, TBody = never>(
        path: string,
        options?: ApiRequestOptions<TBody>
      ) => {
        requestedPath = path;
        authenticated = options?.authenticated;
        return Promise.resolve({ count: 17 }) as Promise<TResponse>;
      }
    };

    const count = await createAppDataSource('api', api).getCompetitionEnrollmentCount(
      '40000000-0000-4000-8000-000000000001',
      'vancouver-bc',
      '2026-08'
    );

    assert.equal(count, 17);
    assert.equal(
      requestedPath,
      '/v1/competitions/2026-08/enrollment-count' +
        '?competitionId=40000000-0000-4000-8000-000000000001&region=vancouver-bc'
    );
    assert.equal(authenticated, false);
  });

  it('loads participant results from the authenticated API boundary', async () => {
    let requestedPath = '';
    let requestedOptions: ApiRequestOptions<never> | undefined;
    const api: ApiClient = {
      request: <TResponse, TBody = never>(
        path: string,
        options?: ApiRequestOptions<TBody>
      ) => {
        requestedPath = path;
        requestedOptions = options as ApiRequestOptions<never> | undefined;
        return Promise.resolve(null) as Promise<TResponse>;
      }
    };

    await createAppDataSource('api', api).getMyLatestCompetitionResults();

    assert.equal(requestedPath, '/v1/results/mine/latest');
    assert.notEqual(requestedOptions?.authenticated, false);
  });

  it('treats a malformed leaderboard response as unavailable', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve({ goal: 4 }) as Promise<TResponse>
    };

    const leaderboard = await createAppDataSource('api', api)
      .getCategoryLeaderboard(4);

    assert.equal(leaderboard, null);
  });

  it('rejects malformed leaderboard rows at the API boundary', async () => {
    const api: ApiClient = {
      request: <TResponse>() =>
        Promise.resolve({
          competitionId: '40000000-0000-4000-8000-000000000001',
          goal: 4,
          rulesVersion: 'rules-v1',
          rows: [
            {
              alias: 'GG-TEST',
              categoryEntries: 12,
              isCurrentUser: true,
              rank: 1,
              streaks: { daily: 1, monthly: 0, weekly: 1, yearly: 0 },
              verifiedDays: 3
            },
            { alias: null, rank: 2 }
          ],
          scoringStatus: 'provisional',
          serverTime: '2026-07-16T12:00:00.000Z',
          settledPeriodCount: 2
        }) as Promise<TResponse>
    };

    const leaderboard = await createAppDataSource('api', api)
      .getCategoryLeaderboard(4);

    assert.equal(leaderboard, null);
  });
});
