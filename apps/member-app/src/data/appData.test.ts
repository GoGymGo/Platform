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
      await unavailable.getCompetitionMatches(
        '2026-08',
        4,
        'toronto-on',
        '40000000-0000-4000-8000-000000000001'
      ),
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

  it('validates exact availability and inventory fields in the public reward contract', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve([
        validRewardCatalogItem()
      ]) as Promise<TResponse>
    };

    const rewards = await createAppDataSource('api', api)
      .getRewardCatalog('toronto', '2026-08');

    assert.equal(rewards[0].inventoryRemaining, 1);
    assert.equal(rewards[0].regionTimezone, 'America/Vancouver');
    assert.equal(rewards[0].availableFrom, '2026-08-01T07:00:00.000Z');
  });

  it('loads published rewards that use the optional image field', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve([{
        ...validRewardCatalogItem(),
        imageUrl: null
      }]) as Promise<TResponse>
    };

    const rewards = await createAppDataSource('api', api)
      .getRewardCatalog('toronto', '2026-08');

    assert.equal(rewards[0].title, 'Recovery coupon');
    assert.equal(rewards[0].imageUrl, null);
  });

  it('rejects malformed or over-counted reward catalog responses', async () => {
    let response: unknown = [{
      ...validRewardCatalogItem(),
      inventoryRemaining: 2
    }];
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve(response) as Promise<TResponse>
    };
    const production = createAppDataSource('api', api);

    await assert.rejects(
      () => production.getRewardCatalog('toronto'),
      /reward catalog response is invalid/i
    );
    response = [{
      ...validRewardCatalogItem(),
      imageUrl: 'http://insecure.example.test/reward.jpg'
    }];
    await assert.rejects(
      () => production.getRewardCatalog('toronto'),
      /reward catalog response is invalid/i
    );
  });

  it('rejects award lists that expose claim-only fields', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve([{
        awardRank: 1,
        awardedAt: '2026-08-15T12:00:00.000Z',
        claimedAt: null,
        couponCode: 'MUST-NOT-APPEAR',
        id: '70000000-0000-4000-8000-000000000001',
        imageUrl: null,
        rewardType: 'coupon',
        sponsorName: 'Sponsor',
        status: 'awarded',
        title: 'Recovery coupon'
      }]) as Promise<TResponse>
    };

    await assert.rejects(
      () => createAppDataSource('api', api).getMyRewardAwards(),
      /reward award response is invalid/i
    );
  });

  it('reuses one claim idempotency key after a lost response and validates the secret path', async () => {
    const idempotencyKeys: string[] = [];
    let attempt = 0;
    const api: ApiClient = {
      request: <TResponse, TBody = never>(
        _path: string,
        options?: ApiRequestOptions<TBody>
      ) => {
        idempotencyKeys.push(options?.idempotencyKey ?? '');
        attempt += 1;
        if (attempt === 1) {
          return Promise.reject(new Error('response lost'));
        }
        return Promise.resolve({
          awardRank: 1,
          awardedAt: "2026-08-15T12:00:00.000Z",
          cashAmountCents: null,
          cashCurrency: null,
          claimedAt: "2026-08-15T12:05:00.000Z",
          claimUrl: null,
          couponCode: 'WIN-ABC-001',
          fulfillmentInstructions: null,
          fulfilledAt: null,
          id: "70000000-0000-4000-8000-000000000001",
          imageUrl: null,
          rewardType: 'coupon',
          sponsorName: 'Sponsor',
          status: 'claimed',
          title: 'Recovery coupon'
        }) as Promise<TResponse>;
      }
    };
    const production = createAppDataSource('api', api);

    await assert.rejects(
      () => production.claimReward('70000000-0000-4000-8000-000000000001'),
      /response lost/i
    );
    const claimed = await production.claimReward(
      '70000000-0000-4000-8000-000000000001'
    );

    assert.equal(claimed.couponCode, 'WIN-ABC-001');
    assert.equal(idempotencyKeys[0], idempotencyKeys[1]);
    assert.match(idempotencyKeys[0], /^reward-claim:/);
  });

  it('loads streak rewards from the authenticated API boundary', async () => {
    let requestedPath = '';
    const api: ApiClient = {
      request: <TResponse>(path: string) => {
        requestedPath = path;
        return Promise.resolve({
          asOfDate: '2026-07-15',
          streaks: {
            daily: 3,
            monthly: 2,
            projectionVersion: 'streaks-v1',
            weekly: 4,
            yearly: 1
          },
          timezone: 'America/Vancouver'
        }) as Promise<TResponse>;
      }
    };

    const streaks = await createAppDataSource('api', api).getMyStreaks();

    assert.equal(requestedPath, '/v1/streaks/me');
    assert.equal(streaks?.streaks.weekly, 4);
  });

  it('fails closed when the own streak projection is unversioned', async () => {
    const api: ApiClient = {
      request: <TResponse>() =>
        Promise.resolve({
          asOfDate: '2026-07-15',
          streaks: { daily: 3, monthly: 2, weekly: 4, yearly: 1 },
          timezone: 'America/Vancouver'
        }) as Promise<TResponse>
    };

    await assert.doesNotReject(async () => {
      assert.equal(await createAppDataSource('api', api).getMyStreaks(), null);
    });
  });

  it('fails closed on a Weekly Challenge row without the required contract', async () => {
    const api: ApiClient = {
      request: <TResponse>() =>
        Promise.resolve([
          {
            availability: 'matched',
            opponentAlias: 'LEGACY_ROW',
            opponentVerifiedDateKeys: ['2026-07-01'],
            periodIndex: 1,
            region: 'vancouver-bc'
          }
        ]) as Promise<TResponse>
    };

    await assert.rejects(
      () => createAppDataSource('api', api).getCompetitionMatches(
        '2026-07',
        4,
        'vancouver-bc',
        '40000000-0000-4000-8000-000000000001'
      ),
      /match response is invalid/i
    );
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

  it('pins direct partner reads to the exact enrolled Contest and week', async () => {
    const paths: string[] = [];
    const api: ApiClient = {
      request: <TResponse>(path: string) => {
        paths.push(path);
        return Promise.resolve([]) as Promise<TResponse>;
      }
    };
    const source = createAppDataSource('api', api);

    await source.getEligibleWeeklyChallengePartners(
      '40000000-0000-4000-8000-000000000001',
      '2026-08',
      4,
      'vancouver-bc',
      2
    );
    await source.getWeeklyChallengeRequests(
      '40000000-0000-4000-8000-000000000001',
      '2026-08',
      4,
      'vancouver-bc',
      2
    );

    assert.deepEqual(paths, [
      '/v1/competitions/2026-08/weekly-challenges/eligible-partners' +
        '?competitionId=40000000-0000-4000-8000-000000000001' +
        '&goal=4&region=vancouver-bc&period=2',
      '/v1/competitions/2026-08/weekly-challenges/requests' +
        '?competitionId=40000000-0000-4000-8000-000000000001' +
        '&goal=4&region=vancouver-bc&period=2'
    ]);
  });

  it('reuses one direct-request idempotency key after a transport failure', async () => {
    const calls: { path: string; options?: ApiRequestOptions<unknown> }[] = [];
    let attempt = 0;
    const api: ApiClient = {
      request: <TResponse, TBody = never>(
        path: string,
        options?: ApiRequestOptions<TBody>
      ) => {
        calls.push({
          path,
          options: options as ApiRequestOptions<unknown> | undefined
        });
        attempt += 1;
        if (attempt === 1) {
          return Promise.reject(new Error('response lost')) as Promise<TResponse>;
        }
        return Promise.resolve({
          createdAt: '2026-08-08T12:00:00.000Z',
          direction: 'outgoing',
          goalDays: 4,
          id: '50000000-0000-4000-8000-000000000001',
          partnerAlias: 'MOVE_MORE',
          partnerStreaks: {
            daily: 3,
            monthly: 1,
            projectionVersion: 'streaks-v1',
            weekly: 2,
            yearly: 0
          },
          periodIndex: 2,
          status: 'pending'
        }) as Promise<TResponse>;
      }
    };
    const source = createAppDataSource('api', api);
    const request = () => source.requestWeeklyChallengePartner(
      '40000000-0000-4000-8000-000000000001',
      '2026-08',
      4,
      'vancouver-bc',
      2,
      '60000000-0000-4000-8000-000000000001'
    );

    await assert.rejects(request, /response lost/i);
    await assert.doesNotReject(request);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options?.idempotencyKey, calls[1].options?.idempotencyKey);
    assert.deepEqual(calls[1].options?.body, {
      competitionId: '40000000-0000-4000-8000-000000000001',
      goal: 4,
      period: 2,
      recipientUserId: '60000000-0000-4000-8000-000000000001',
      region: 'vancouver-bc'
    });
  });

  it('rejects request payloads that leak an internal partner identifier', async () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve([{
        createdAt: '2026-08-08T12:00:00.000Z',
        direction: 'incoming',
        goalDays: 4,
        id: '50000000-0000-4000-8000-000000000001',
        partnerAlias: 'MOVE_MORE',
        partnerStreaks: {
          daily: 3,
          monthly: 1,
          projectionVersion: 'streaks-v1',
          weekly: 2,
          yearly: 0
        },
        partnerUserId: 'private-internal-id',
        periodIndex: 2,
        status: 'pending'
      }]) as Promise<TResponse>
    };

    await assert.rejects(
      () => createAppDataSource('api', api).getWeeklyChallengeRequests(
        '40000000-0000-4000-8000-000000000001',
        '2026-08',
        4,
        'vancouver-bc',
        2
      ),
      /request response is invalid/i
    );
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

  it('runtime-validates an exact settled Winners Circle response', async () => {
    const response = settledWinnersCircleResponse();
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve(response) as Promise<TResponse>
    };

    await assert.doesNotReject(() =>
      createAppDataSource('api', api).getMyLatestCompetitionResults()
    );
  });

  it('accepts shared first-place ranks for equal Goal Scores', async () => {
    const response = settledWinnersCircleResponse();
    const first = response.categoryLeaderboards[0]!.rows[0]!;
    response.categoryLeaderboards[0]!.rows.push({
      ...first,
      alias: 'TIED_CHAMPION',
      isCurrentUser: false,
      rank: 1
    });
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve(response) as Promise<TResponse>
    };

    await assert.doesNotReject(() =>
      createAppDataSource('api', api).getMyLatestCompetitionResults()
    );
  });

  it("accepts only the exact September pilot cash snapshot", async () => {
    const base = settledWinnersCircleResponse();
    const pilot = {
      ...base,
      competitionName: "GoGymGo September 2026 Island Pilot",
      monthKey: "2026-09",
      regionCode: "vancouver-island-gulf-islands-bc",
      rewardWinners: [
        {
          ...base.rewardWinners[0]!,
          cashAmountCents: 10000,
          cashCurrency: "CAD",
          rewardTitle: "GoGymGo $100 CAD Cash Reward",
          rewardType: "cash",
          sponsorName: "GoGymGo",
        },
      ],
    };
    const validApi: ApiClient = {
      request: <TResponse>() => Promise.resolve(pilot) as Promise<TResponse>,
    };
    await assert.doesNotReject(() =>
      createAppDataSource("api", validApi).getMyLatestCompetitionResults(),
    );

    const invalidApi: ApiClient = {
      request: <TResponse>() =>
        Promise.resolve({
          ...pilot,
          rewardWinners: [{ ...pilot.rewardWinners[0], cashAmountCents: 9999 }],
        }) as Promise<TResponse>,
    };
    await assert.rejects(
      () =>
        createAppDataSource("api", invalidApi).getMyLatestCompetitionResults(),
      /September pilot reward snapshot is inconsistent/i,
    );
  });

  it("rejects private winner identifiers and inconsistent pending results", async () => {
    const leaked = settledWinnersCircleResponse();
    const winner = leaked.rewardWinners[0]!;
    const leakedApi: ApiClient = {
      request: <TResponse>() => Promise.resolve({
        ...leaked,
        rewardWinners: [{ ...winner, userId: 'private-user-id' }]
      }) as Promise<TResponse>
    };
    await assert.rejects(
      () => createAppDataSource('api', leakedApi).getMyLatestCompetitionResults(),
      /Winners Circle response is invalid/i
    );

    const pendingApi: ApiClient = {
      request: <TResponse>() => Promise.resolve({
        ...leaked,
        categoryLeaderboards: [],
        resultsStatus: 'pending',
        rewardCount: 0,
        rewardWinners: [],
        settledAt: leaked.settledAt
      }) as Promise<TResponse>
    };
    await assert.rejects(
      () => createAppDataSource('api', pendingApi).getMyLatestCompetitionResults(),
      /pending Winners Circle response is inconsistent/i
    );
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
              streaks: {
                daily: 1,
                monthly: 0,
                projectionVersion: 'streaks-v1',
                weekly: 1,
                yearly: 0
              },
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

function settledWinnersCircleResponse() {
  const streaks = {
    daily: 2,
    monthly: 4,
    projectionVersion: 'streaks-v1' as const,
    weekly: 2,
    yearly: 4
  };
  return {
    categoryLeaderboards: [{
      competitionId: '40000000-0000-4000-8000-000000000001',
      goal: 4,
      rows: [{
        alias: 'MOVE_MORE',
        categoryEntries: 42,
        isCurrentUser: true,
        rank: 1,
        streaks,
        verifiedDays: 20
      }],
      rulesVersion: 'rules-v1',
      scoringStatus: 'final',
      serverTime: '2026-09-01T08:00:00.000Z',
      settledPeriodCount: 4
    }],
    competitionId: '40000000-0000-4000-8000-000000000001',
    competitionName: 'August Challenge',
    endedAt: '2026-09-01T07:00:00.000Z',
    monthKey: '2026-08',
    participantGoalDays: 4,
    regionCode: 'vancouver-bc',
    regionName: 'Vancouver',
    resultsStatus: 'settled',
    rewardCount: 1,
    rewardWinners: [
      {
        alias: "MOVE_MORE",
        awardRank: 1,
        cashAmountCents: null,
        cashCurrency: null,
        prizeDrawEntries: 42,
        rewardTitle: "Recovery Kit",
        rewardType: "physical",
        sponsorName: "GoGymGo",
        streaks,
      },
    ],
    settledAt: "2026-09-01T08:00:00.000Z",
  };
}

function validRewardCatalogItem() {
  return {
    availableFrom: "2026-08-01T07:00:00.000Z",
    availableUntil: "2026-09-01T07:00:00.000Z",
    cashAmountCents: null,
    cashCurrency: null,
    competitionId: "40000000-0000-4000-8000-000000000001",
    competitionName: "August contest",
    description: "A sponsor-funded recovery reward.",
    id: "70000000-0000-4000-8000-000000000001",
    imageUrl: "https://cdn.example.test/reward.jpg",
    inventoryRemaining: 1,
    inventoryTotal: 1,
    monthKey: '2026-08',
    regionCode: 'toronto',
    regionName: 'Toronto',
    regionTimezone: 'America/Vancouver',
    rewardType: 'coupon',
    sponsorName: 'Sponsor',
    termsUrl: 'https://sponsor.example.test/terms',
    title: 'Recovery coupon'
  };
}
