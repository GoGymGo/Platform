import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAppDataSource } from '@/data/appData';
import type { ApiClient, ApiRequestOptions } from '@/services/api/client';

describe('app data boundary', () => {
  it('keeps demo fixtures available only in demo mode', async () => {
    const demo = createAppDataSource('demo');

    assert.ok((await demo.getCreatorWorkouts()).length > 0);
    assert.ok((await demo.getRewardCatalog('toronto', '2026-08')).length > 0);
    const leaderboard = await demo.getCategoryLeaderboard(4);
    assert.equal(leaderboard?.rows.length, 10);
    assert.deepEqual(leaderboard?.rows[0]?.streaks, {
      daily: 18,
      monthly: 5,
      weekly: 9,
      yearly: 2
    });
    assert.equal(await demo.getCompetitionEnrollmentCount('TORONTO', '2026-08'), 84);
    assert.deepEqual((await demo.getMyStreaks())?.streaks, {
      daily: 3,
      monthly: 2,
      weekly: 4,
      yearly: 1
    });
    assert.notEqual(await demo.getSettledCompetition(), null);
  });

  it('returns honest empty data when production services are unavailable', async () => {
    const production = createAppDataSource('unavailable');

    assert.deepEqual(await production.getCreatorWorkouts(), []);
    assert.deepEqual(await production.getRewardCatalog('toronto'), []);
    assert.deepEqual(await production.getMyRewardAwards(), []);
    assert.deepEqual(await production.getRewardWinners(), []);
    assert.equal(await production.getCategoryLeaderboard(4), null);
    assert.deepEqual(await production.getCompetitionMatches('2026-08', 4, 'TORONTO'), []);
    assert.equal(await production.getCompetitionEnrollmentCount('TORONTO', '2026-08'), null);
    assert.equal(await production.getMyStreaks(), null);
    assert.equal(production.getSessionTelemetry(60), null);
    assert.equal(await production.getSettledCompetition(), null);
  });

  it('requires an authenticated API client for API mode', () => {
    assert.throws(
      () => createAppDataSource('api'),
      /requires a configured API client/i
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

  it('plans a creator workout and exposes eligible Weekly Challenge partners in demo mode', async () => {
    const demo = createAppDataSource('demo');
    const workout = (await demo.getCreatorWorkouts()).find(({ joined }) => joined);
    assert.ok(workout);

    const plan = await demo.planCreatorWorkout(workout.id, '2026-07-16');
    assert.equal(plan.workoutId, workout.id);
    assert.ok((await demo.getCreatorWorkoutPlans()).some(({ id }) => id === plan.id));

    const partners = await demo.getEligibleWeeklyChallengePartners(
      '2026-07',
      4,
      'TORONTO',
      3
    );
    assert.ok(partners.every(({ goalDays }) => goalDays === 4));
  });
});
