import assert from 'node:assert/strict';
import test from 'node:test';

import { createGymScanRepository } from './gymScanRepository';
import type { ApiClient } from '@/services/api/client';

test('submits one authenticated static QR scan contract with idempotency', async () => {
  const requests: unknown[] = [];
  const api: ApiClient = {
    request: async (path, options) => {
      requests.push({ options, path });
      return {
        credentialVersion: 1,
        expiresAt: null,
        gymLocationId: null,
        gymName: null,
        minimumCompleteAt: null,
        outcome: 'rejected',
        rejectionReason: 'outside_geofence',
        remainingSeconds: 0,
        serverTimestamp: '2026-09-01T07:00:00.000Z',
        sessionId: null,
        startedAt: null
      } as never;
    }
  };
  const input = {
    accuracyMeters: 8,
    credential: 'a'.repeat(32),
    eventId: '10000000-0000-4000-8000-000000000001',
    latitude: 48.4284,
    longitude: -123.3656
  };

  await createGymScanRepository(api).scan(input);
  assert.deepEqual(requests, [
    {
      options: {
        body: input,
        idempotencyKey: 'gym-scan-10000000-0000-4000-8000-000000000001',
        method: 'POST'
      },
      path: '/v1/gym-scans'
    }
  ]);
});

test('submits a fresh enrolled-gym location check without a QR credential', async () => {
  const requests: unknown[] = [];
  const api: ApiClient = {
    request: async (path, options) => {
      requests.push({ options, path });
      return { outcome: 'started' } as never;
    }
  };
  const input = {
    accuracyMeters: 8,
    competitionId: '10000000-0000-4000-8000-000000000010',
    eventId: '10000000-0000-4000-8000-000000000011',
    latitude: 48.4284,
    longitude: -123.3656
  };

  await createGymScanRepository(api).scan(input);
  assert.deepEqual(requests, [
    {
      options: {
        body: input,
        idempotencyKey: 'gym-scan-10000000-0000-4000-8000-000000000011',
        method: 'POST'
      },
      path: '/v1/gym-scans'
    }
  ]);
});
