import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearPendingGymScanSession,
  pendingGymScanMaxAgeMs,
  readPendingGymScan,
  rememberCompetitionGymAccess,
  rememberCompetitionGymScanResult,
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

  it('keeps the selected gym available through the enrolled competition', async () => {
    const storage = createMemoryStorage();
    await rememberGymScanCredential(credential, { now: () => startedAt, storage });
    await rememberCompetitionGymAccess(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-10-01T07:00:00.000Z'
      },
      { now: () => startedAt, storage }
    );

    const stored = await readPendingGymScan({
      now: () => startedAt + pendingGymScanMaxAgeMs + 1,
      storage
    });
    assert.equal(stored?.competitionId, 'competition-1');
    assert.equal(stored?.credential, null);

    assert.equal(
      await readPendingGymScan({
        now: () => Date.parse('2026-10-01T07:00:00.001Z'),
        storage
      }),
      null
    );
  });

  it('removes a QR payload retained by legacy enrolled storage', async () => {
    const storage = createMemoryStorage();
    await storage.setItem(
      '@gogymgo/pending-gym-scan',
      JSON.stringify({
        activeSession: null,
        competitionId: 'competition-1',
        credential,
        credentialValidUntil: '2026-10-01T07:00:00.000Z',
        createdAt: startedAt
      })
    );

    const stored = await readPendingGymScan({ now: () => startedAt, storage });
    assert.equal(stored?.competitionId, 'competition-1');
    assert.equal(stored?.credential, null);
    assert.equal(
      JSON.parse((await storage.getItem('@gogymgo/pending-gym-scan')) ?? '{}').credential,
      null
    );
  });

  it('keeps enrolled gym access through the 15-minute completion grace period', async () => {
    const storage = createMemoryStorage();
    await rememberGymScanCredential(credential, { now: () => startedAt, storage });
    await rememberCompetitionGymAccess(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-09-01T17:20:00.000Z'
      },
      { now: () => startedAt, storage }
    );
    assert.equal(
      (
        await readPendingGymScan({
          now: () => Date.parse('2026-09-01T17:19:59.999Z'),
          storage
        })
      )?.credential,
      null
    );

    assert.equal(
      await readPendingGymScan({
        now: () => Date.parse('2026-09-01T17:20:00.000Z'),
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

  it('clears the active workout but keeps enrolled gym access after verification', async () => {
    const storage = createMemoryStorage();
    const dependencies = { now: () => startedAt, storage };
    await rememberGymScanCredential(credential, dependencies);
    await rememberCompetitionGymAccess(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-10-01T07:00:00.000Z'
      },
      dependencies
    );
    await rememberCompetitionGymScanResult(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-10-01T07:00:00.000Z',
        result: {
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
        }
      },
      dependencies
    );
    await rememberCompetitionGymScanResult(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-10-01T07:00:00.000Z',
        result: {
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
        }
      },
      dependencies
    );

    const stored = await readPendingGymScan(dependencies);
    assert.equal(stored?.activeSession, null);
    assert.equal(stored?.competitionId, 'competition-1');
    assert.equal(stored?.credential, null);
  });

  it('clears a cancelled workout while preserving enrolled gym access', async () => {
    const storage = createMemoryStorage();
    const dependencies = { now: () => startedAt, storage };
    await rememberGymScanCredential(credential, dependencies);
    await rememberCompetitionGymAccess(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-10-01T07:00:00.000Z'
      },
      dependencies
    );
    await rememberCompetitionGymScanResult(
      {
        competitionId: 'competition-1',
        credentialValidUntil: '2026-10-01T07:00:00.000Z',
        result: {
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
        }
      },
      dependencies
    );

    const stored = await clearPendingGymScanSession(dependencies);
    assert.equal(stored?.activeSession, null);
    assert.equal(stored?.competitionId, 'competition-1');
    assert.equal(stored?.credential, null);
    assert.equal(
      (await readPendingGymScan(dependencies))?.credentialValidUntil,
      '2026-10-01T07:00:00.000Z'
    );
  });
});
