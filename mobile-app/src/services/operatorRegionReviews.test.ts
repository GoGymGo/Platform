import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiClient } from '@/services/api/client';
import {
  decideBcRegionReview,
  listPendingBcRegionReviews
} from '@/services/operatorRegionReviews';

describe('operator BC region review client', () => {
  it('exposes only pending BC region submissions', async () => {
    const api = {
      request: () => Promise.resolve([
        {
          createdAt: '2026-07-13T12:00:00.000Z',
          id: 'bc-review',
          kind: 'region_verification',
          regionCode: 'CA-BC-DEMO',
          status: 'pending',
          verificationMethod: 'postal_code'
        },
        {
          createdAt: '2026-07-13T12:00:00.000Z',
          id: 'other-review',
          kind: 'region_verification',
          regionCode: 'CA-ON-DEMO',
          status: 'pending',
          verificationMethod: 'postal_code'
        },
        {
          createdAt: '2026-07-13T12:00:00.000Z',
          id: 'session',
          kind: 'workout_session',
          status: 'pending_review'
        }
      ])
    } as ApiClient;

    assert.deepEqual(await listPendingBcRegionReviews(api), [{
      createdAt: '2026-07-13T12:00:00.000Z',
      id: 'bc-review',
      regionCode: 'CA-BC-DEMO',
      status: 'pending',
      verificationMethod: 'postal_code'
    }]);
  });

  it('sends an idempotent decision with the operator reason', async () => {
    const calls: unknown[] = [];
    const api = {
      request: (path: string, options?: unknown) => {
        calls.push({ options, path });
        return Promise.resolve({ id: 'bc-review', status: 'approved' });
      }
    } as ApiClient;

    await decideBcRegionReview(
      api,
      'bc-review',
      'approved',
      '  BC demo eligibility approved.  '
    );
    assert.deepEqual(calls, [{
      options: {
        body: {
          decision: 'approved',
          reason: 'BC demo eligibility approved.'
        },
        idempotencyKey: 'bc-region-review:bc-review:approved',
        method: 'POST'
      },
      path: '/v1/operator/region-verifications/bc-review/decision'
    }]);
  });
});
