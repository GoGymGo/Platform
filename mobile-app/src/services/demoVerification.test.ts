import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiClient } from '@/services/api/client';
import { createDemoCheckIn } from '@/services/demoVerification';

describe('demo verification client', () => {
  it('sends only the fixed checkpoint type and British Columbia region code', async () => {
    const calls: unknown[] = [];
    const response = {
      checkpointType: 'session_start' as const,
      demo: true as const,
      expiresAt: '2026-07-13T20:05:00.000Z',
      id: '10000000-0000-4000-8000-000000000001',
      issuedAt: '2026-07-13T20:00:00.000Z',
      outcome: 'simulated' as const,
      provider: 'canada_demo' as const,
      regionCode: 'CA-BC'
    };
    const api = {
      request: async (path: string, options?: unknown) => {
        calls.push({ options, path });
        return response;
      }
    } as ApiClient;

    await assert.doesNotReject(() => createDemoCheckIn(api));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      options: {
        body: { checkpointType: 'session_start', regionCode: 'CA-BC' },
        idempotencyKey: (calls[0] as { options: { idempotencyKey: string } }).options
          .idempotencyKey,
        method: 'POST'
      },
      path: '/v1/demo-verifications/check-ins'
    });
    assert.match(
      (calls[0] as { options: { idempotencyKey: string } }).options.idempotencyKey,
      /^demo-check-in:\d+$/
    );
  });
});
