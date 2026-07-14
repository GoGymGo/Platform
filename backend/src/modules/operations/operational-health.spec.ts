import { resolveWorkerHealth } from './operational-health';

describe('operational worker health', () => {
  const now = new Date('2026-07-13T12:00:00.000Z');

  it('distinguishes startup, healthy, failed, and stale workers', () => {
    expect(
      resolveWorkerHealth(
        {
          lastCompletedAt: null,
          lastFailedAt: null,
          lastStartedAt: new Date(now.getTime() - 10_000),
          status: 'running',
        },
        now,
        120_000,
      ).status,
    ).toBe('starting');
    expect(
      resolveWorkerHealth(
        {
          lastCompletedAt: new Date(now.getTime() - 30_000),
          lastFailedAt: null,
          lastStartedAt: new Date(now.getTime() - 60_000),
          status: 'running',
        },
        now,
        120_000,
      ),
    ).toEqual({ heartbeatAgeMs: 30_000, status: 'healthy' });
    expect(
      resolveWorkerHealth(
        {
          lastCompletedAt: null,
          lastFailedAt: new Date(now.getTime() - 1_000),
          lastStartedAt: new Date(now.getTime() - 10_000),
          status: 'failed',
        },
        now,
        120_000,
      ).status,
    ).toBe('degraded');
    expect(
      resolveWorkerHealth(
        {
          lastCompletedAt: new Date(now.getTime() - 121_000),
          lastFailedAt: null,
          lastStartedAt: new Date(now.getTime() - 180_000),
          status: 'running',
        },
        now,
        120_000,
      ).status,
    ).toBe('stale');
  });

  it('reports a missing heartbeat as stale', () => {
    expect(resolveWorkerHealth(null, now, 120_000)).toEqual({
      heartbeatAgeMs: null,
      status: 'stale',
    });
  });
});
