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
          startedAt: '2026-07-16T12:00:00.000Z',
          status: 'active'
        }) as Promise<TResponse>;
      }
    };
    const sessions = createWorkoutSessionRepository('api', api);
    const sessionId = '60000000-0000-4000-8000-000000000001';

    await sessions.createSession(
      '40000000-0000-4000-8000-000000000001',
      'attempt-1'
    );
    await sessions.appendHeartRateSample(
      sessionId,
      132,
      '2026-07-16T12:00:30.000Z'
    );
    await sessions.appendGymQrScan(
      sessionId,
      'gogymgo:gym:exit:partner-one'
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
        { method: 'POST', path: `/v1/sessions/${sessionId}/complete` },
        { method: 'POST', path: `/v1/sessions/${sessionId}/cancel` },
        { method: undefined, path: '/v1/me/progress' }
      ]
    );
    assert.equal(requests[0].idempotencyKey, 'session-create-attempt-1');
    assert.equal(requests[3].idempotencyKey, `session-complete-${sessionId}`);
    assert.equal(requests[4].idempotencyKey, `session-cancel-${sessionId}`);
    assert.deepEqual(requests[0].body, {
      competitionId: '40000000-0000-4000-8000-000000000001'
    });
    assert.deepEqual(
      requests.slice(1, 3).map(({ body }) =>
        (body as { eventType: string }).eventType
      ),
      ['heart_rate_sample', 'gym_qr_scan']
    );
  });

  it('supports the complete demo lifecycle without awarding before completion', async () => {
    const sessions = createWorkoutSessionRepository('demo', null);
    const created = await sessions.createSession(
      '40000000-0000-4000-8000-000000000001',
      'demo-attempt'
    );
    const completed = await sessions.completeSession(created.id);

    assert.equal(created.status, 'active');
    assert.equal(completed.status, 'verified');
    assert.equal(completed.eligibleForReview, true);
  });
});
