import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createWorkoutSessionRepository } from '@/data/sessionRepository';

describe('workout session repository', () => {
  it('maps the authoritative session command and evidence routes', async () => {
    const requests: {
      body?: unknown;
      idempotencyKey?: string;
      method?: string;
      path: string;
    }[] = [];
    const api = {
      request: <TResponse>(
        path: string,
        options?: { body?: unknown; idempotencyKey?: string; method?: string }
      ) => {
        requests.push({
          body: options?.body,
          idempotencyKey: options?.idempotencyKey,
          method: options?.method,
          path
        });
        return Promise.resolve({
          completedAt: null,
          competitionId: '40000000-0000-4000-8000-000000000001',
          eligibleDate: '2026-07-16',
          id: '60000000-0000-4000-8000-000000000001',
          policyVersion: 'rules-v1',
          requirements: {
            minHeartRateSamples: 2,
            minSessionMinutes: 20,
            requireDeviceAttestation: false,
            requireGymQr: false,
            requirePresenceCheck: true
          },
          startedAt: '2026-07-16T12:00:00.000Z',
          status: 'active'
        }) as Promise<TResponse>;
      }
    };
    const sessions = createWorkoutSessionRepository('api', api);
    const sessionId = '60000000-0000-4000-8000-000000000001';

    const started = await sessions.createSession(
      '40000000-0000-4000-8000-000000000001',
      'attempt-1'
    );
    assert.deepEqual(started.requirements, {
      minHeartRateSamples: 2,
      minSessionMinutes: 20,
      requireDeviceAttestation: false,
      requireGymQr: false,
      requirePresenceCheck: true
    });
    await sessions.appendHeartRateSample(
      sessionId,
      132,
      '2026-07-16T12:00:30.000Z'
    );
    await sessions.appendGymQrScan(
      sessionId,
      'gogymgo:gym:exit:partner-one'
    );
    await sessions.appendPresenceCheck(
      sessionId,
      '2026-07-16T12:15:00.000Z'
    );
    await sessions.completeSession(sessionId);
    await sessions.cancelSession(sessionId);
    await sessions.getCompetitionProgress();

    assert.deepEqual(
      requests.map(({ method, path }) => ({ method, path })),
      [
        { method: 'POST', path: '/v1/sessions' },
        { method: 'POST', path: `/v1/sessions/${sessionId}/events` },
        { method: 'POST', path: `/v1/sessions/${sessionId}/events` },
        { method: 'POST', path: `/v1/sessions/${sessionId}/events` },
        { method: 'POST', path: `/v1/sessions/${sessionId}/complete` },
        { method: 'POST', path: `/v1/sessions/${sessionId}/cancel` },
        { method: undefined, path: '/v1/me/progress' }
      ]
    );
    assert.equal(requests[0].idempotencyKey, 'session-create-attempt-1');
    assert.equal(requests[4].idempotencyKey, `session-complete-${sessionId}`);
    assert.equal(requests[5].idempotencyKey, `session-cancel-${sessionId}`);
    assert.deepEqual(requests[0].body, {
      competitionId: '40000000-0000-4000-8000-000000000001'
    });
    assert.deepEqual(
      requests.slice(1, 4).map(({ body }) =>
        (body as { eventType: string }).eventType
      ),
      ['heart_rate_sample', 'gym_qr_scan', 'presence_check']
    );
  });

  it('does not fabricate a workout lifecycle when the API is unavailable', async () => {
    const sessions = createWorkoutSessionRepository('unavailable', null);

    assert.equal(await sessions.getCompetitionProgress(), null);
    await assert.rejects(
      () => sessions.createSession(
        '40000000-0000-4000-8000-000000000001',
        'offline-attempt'
      ),
      /not configured/i
    );
  });
});
