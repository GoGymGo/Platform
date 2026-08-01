import type { WorkerHeartbeatStatus } from '../../database/database.types';

export type WorkerHealthStatus = 'degraded' | 'healthy' | 'stale' | 'starting';

export interface WorkerHeartbeatSnapshot {
  lastCompletedAt: Date | null;
  lastFailedAt: Date | null;
  lastStartedAt: Date;
  status: WorkerHeartbeatStatus;
}

export function resolveWorkerHealth(
  heartbeat: WorkerHeartbeatSnapshot | null,
  now: Date,
  staleAfterMs: number,
): { heartbeatAgeMs: number | null; status: WorkerHealthStatus } {
  if (!heartbeat) return { heartbeatAgeMs: null, status: 'stale' };
  const heartbeatAgeMs = heartbeat.lastCompletedAt
    ? Math.max(0, now.getTime() - heartbeat.lastCompletedAt.getTime())
    : null;

  if (
    heartbeat.status === 'failed' &&
    (!heartbeat.lastCompletedAt ||
      (heartbeat.lastFailedAt ?? new Date(0)) >= heartbeat.lastCompletedAt)
  ) {
    return { heartbeatAgeMs, status: 'degraded' };
  }
  if (
    heartbeat.status === 'running' &&
    !heartbeat.lastCompletedAt &&
    now.getTime() - heartbeat.lastStartedAt.getTime() < staleAfterMs
  ) {
    return { heartbeatAgeMs, status: 'starting' };
  }
  if (
    heartbeat.status === 'running' &&
    heartbeatAgeMs !== null &&
    heartbeatAgeMs <= staleAfterMs
  ) {
    return { heartbeatAgeMs, status: 'healthy' };
  }
  return { heartbeatAgeMs, status: 'stale' };
}
