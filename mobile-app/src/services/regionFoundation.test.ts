import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiClient } from '@/services/api/client';
import {
  getCurrentBcRegionVerification,
  submitBcRegionVerification
} from '@/services/regionFoundation';

describe('BC region foundation client', () => {
  it('reads the signed-in user latest BC review status', async () => {
    const calls: string[] = [];
    const api = {
      request: (path: string) => {
        calls.push(path);
        return Promise.resolve(null);
      }
    } as ApiClient;

    assert.equal(await getCurrentBcRegionVerification(api), null);
    assert.deepEqual(calls, [
      '/v1/me/region-verifications/current?regionCode=CA-BC-DEMO'
    ]);
  });

  it('submits minimized postal evidence only to a disabled BC policy', async () => {
    const calls: { options?: unknown; path: string }[] = [];
    const api = {
      request: (path: string, options?: unknown) => {
        calls.push({ options, path });
        if (path === '/v1/regions') {
          return Promise.resolve([{
            code: 'CA-BC-DEMO',
            competitionEnabled: false,
            countryCode: 'CA',
            id: '10000000-0000-4000-8000-000000000001',
            payoutEnabled: false,
            policyVersion: 'bc-demo-foundation-v1',
            subdivisionCode: 'BC'
          }]);
        }
        return Promise.resolve({ status: 'pending' });
      }
    } as ApiClient;

    await submitBcRegionVerification(api, {
      method: 'postal-code',
      postalCode: 'V8W 1P6'
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], {
      options: { authenticated: false },
      path: '/v1/regions'
    });
    assert.deepEqual(calls[1], {
      options: {
        body: {
          method: 'postal_code',
          postalCode: 'V8W 1P6',
          regionPolicyId: '10000000-0000-4000-8000-000000000001'
        },
        idempotencyKey: (
          calls[1].options as { idempotencyKey: string }
        ).idempotencyKey,
        method: 'POST'
      },
      path: '/v1/me/region-verifications'
    });
    assert.match(
      (calls[1].options as { idempotencyKey: string }).idempotencyKey,
      /^region-verification:10000000-0000-4000-8000-000000000001:postal-code:\d+$/
    );
  });

  it('refuses an activated payout policy', async () => {
    const api = {
      request: () => Promise.resolve([{
        code: 'CA-BC-DEMO',
        competitionEnabled: false,
        countryCode: 'CA',
        id: '10000000-0000-4000-8000-000000000001',
        payoutEnabled: true,
        policyVersion: 'bc-demo-foundation-v1',
        subdivisionCode: 'BC'
      }])
    } as ApiClient;

    await assert.rejects(
      () => submitBcRegionVerification(api, {
        latitude: 48.4284,
        longitude: -123.3656,
        method: 'device-location'
      }),
      /required disabled state/
    );
  });
});
