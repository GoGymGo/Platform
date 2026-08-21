import type { WorkerHeartbeatStatus } from '../../database/database.types';

export type WorkerHealthStatus = 'degraded' | 'healthy' | 'stale' | 'starting';
export type ProviderHealthStatus =
  'configured' | 'disabled' | 'unavailable' | 'unconfigured';

export interface ProviderHealthSnapshot {
  evidence: string;
  status: ProviderHealthStatus;
}

export interface WorkerHeartbeatSnapshot {
  lastCompletedAt: Date | null;
  lastFailedAt: Date | null;
  lastStartedAt: Date;
  lastResult?: unknown;
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
  if (hasRecordedOperationFailures(heartbeat.lastResult)) {
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

export function resolveProviderHealth(input: {
  configured: boolean;
  enabled: boolean;
  failureCount: number;
  service: string;
}): ProviderHealthSnapshot {
  if (!input.enabled) {
    return {
      evidence: `${input.service} is disabled by configuration. No provider probe was made.`,
      status: 'disabled',
    };
  }
  if (!input.configured) {
    return {
      evidence: `${input.service} is enabled but required configuration is absent. No provider probe was made.`,
      status: 'unconfigured',
    };
  }
  if (input.failureCount > 0) {
    return {
      evidence: `${input.service} has ${input.failureCount} durable failed item(s). No provider probe was made.`,
      status: 'unavailable',
    };
  }
  return {
    evidence: `${input.service} is configured and has no durable failure evidence. No provider probe was made.`,
    status: 'configured',
  };
}

function hasRecordedOperationFailures(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return ['profileMediaCleanupFailed', 'privacyOperationsFailed'].some(
    (key) => typeof result[key] === 'number' && result[key] > 0,
  );
}
