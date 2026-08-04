import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  pendingGymScanMaxAgeMs,
  readPendingGymScan,
  rememberGymScanCredential,
  rememberGymScanResult
} from './pendingGymScan';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    removeItem: async (key: string) => {
      values.delete(key);
    },
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    }
  };
}

describe('pending gym scan storage', () => {
  const credential = 'a'.repeat(32);
  const startedAt = Date.parse('2026-09-01T17:00:00.000Z');

  it('keeps a scanned poster long enough to finish authentication and setup', async () => {
    const storage = createMemoryStorage();
    await rememberGymScanCredential(credential, { now: () => startedAt, storage });

    assert.equal(
      (await readPendingGymScan({ now: () => startedAt + 30 * 60 * 1000, storage }))?.credential,
      credential
    );
  });

  it('expires abandoned poster intents after four hours', async () => {
    const storage = createMemoryStorage();
    await rememberGymScanCredential(credential, { now: () => startedAt, storage });

    assert.equal(
      await readPendingGymScan({
        now: () => startedAt + pendingGymScanMaxAgeMs + 1,
        storage
      }),
      null
    );
  });

  it('remembers an authoritative active session and clears it after verification', async () => {
    const storage = createMemoryStorage();
    const dependencies = { now: () => startedAt, storage };
    await rememberGymScanResult(
      credential,
      {
        credentialVersion: 1,
        expiresAt: '2026-09-01T21:00:00.000Z',
        gymLocationId: 'gym-1',
        gymName: 'SkyGate',
        minimumCompleteAt: '2026-09-01T17:30:00.000Z',
        outcome: 'started',
        rejectionReason: null,
        remainingSeconds: 1800,
        serverTimestamp: '2026-09-01T17:00:00.000Z',
        sessionId: 'session-1',
        startedAt: '2026-09-01T17:00:00.000Z'
      },
      dependencies
    );
    assert.equal((await readPendingGymScan(dependencies))?.activeSession?.gymName, 'SkyGate');

    await rememberGymScanResult(
      credential,
      {
        credentialVersion: 1,
        expiresAt: null,
        gymLocationId: 'gym-1',
        gymName: 'SkyGate',
        minimumCompleteAt: null,
        outcome: 'verified',
        rejectionReason: null,
        remainingSeconds: 0,
        serverTimestamp: '2026-09-01T17:31:00.000Z',
        sessionId: 'session-1',
        startedAt: '2026-09-01T17:00:00.000Z'
      },
      dependencies
    );
    assert.equal(await readPendingGymScan(dependencies), null);
  });
});
