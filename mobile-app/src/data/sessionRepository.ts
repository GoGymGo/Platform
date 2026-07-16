import type { AppDataMode } from '@/data/appData';
import type {
  AuthoritativeWorkoutSession,
  CompetitionProgress,
  WorkoutSessionCompletion
} from '@/domain/session';
import type { ApiClient } from '@/services/api/client';

export type WorkoutSessionRepository = {
  appendGymQrScan: (sessionId: string, qrPayload: string) => Promise<void>;
  appendHeartRateSample: (
    sessionId: string,
    heartRateBpm: number,
    occurredAt?: string
  ) => Promise<void>;
  cancelSession: (sessionId: string) => Promise<AuthoritativeWorkoutSession>;
  completeSession: (
    sessionId: string,
    clientCompletedAt?: string
  ) => Promise<WorkoutSessionCompletion>;
  createSession: (
    competitionId: string,
    commandId: string
  ) => Promise<AuthoritativeWorkoutSession>;
  getCompetitionProgress: () => Promise<CompetitionProgress | null>;
};

export function createWorkoutSessionRepository(
  mode: AppDataMode,
  api: ApiClient | null
): WorkoutSessionRepository {
  if (mode === 'api') return createApiRepository(requireApi(api));
  if (mode === 'demo') return createDemoRepository();
  return createUnavailableRepository();
}

function createApiRepository(api: ApiClient): WorkoutSessionRepository {
  const appendEvent = (
    sessionId: string,
    event: Record<string, unknown>
  ) => {
    const eventId = createUuid();
    return api.request<unknown, Record<string, unknown>>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/events`,
      {
        body: {
          eventId,
          occurredAt: new Date().toISOString(),
          ...event
        },
        idempotencyKey: `session-event-${eventId}`,
        method: 'POST'
      }
    ).then(() => undefined);
  };

  return {
    appendGymQrScan: (sessionId, qrPayload) => appendEvent(sessionId, {
      eventType: 'gym_qr_scan',
      qrPayload
    }),
    appendHeartRateSample: (sessionId, heartRateBpm, occurredAt) => {
      const eventId = createUuid();
      return api.request<unknown, {
        eventId: string;
        eventType: 'heart_rate_sample';
        heartRateBpm: number;
        occurredAt: string;
      }>(`/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
        body: {
          eventId,
          eventType: 'heart_rate_sample',
          heartRateBpm,
          occurredAt: occurredAt ?? new Date().toISOString()
        },
        idempotencyKey: `session-event-${eventId}`,
        method: 'POST'
      }).then(() => undefined);
    },
    cancelSession: (sessionId) => api.request<AuthoritativeWorkoutSession>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/cancel`,
      {
        idempotencyKey: `session-cancel-${sessionId}`,
        method: 'POST'
      }
    ),
    completeSession: (sessionId, clientCompletedAt) =>
      api.request<WorkoutSessionCompletion, { clientCompletedAt?: string }>(
        `/v1/sessions/${encodeURIComponent(sessionId)}/complete`,
        {
          body: clientCompletedAt ? { clientCompletedAt } : {},
          idempotencyKey: `session-complete-${sessionId}`,
          method: 'POST'
        }
      ),
    createSession: (competitionId, commandId) =>
      api.request<AuthoritativeWorkoutSession, { competitionId: string }>(
        '/v1/sessions', {
        body: { competitionId },
        idempotencyKey: `session-create-${commandId}`,
        method: 'POST'
      }),
    getCompetitionProgress: () => api.request<CompetitionProgress | null>(
      '/v1/me/progress'
    )
  };
}

function createDemoRepository(): WorkoutSessionRepository {
  const sessions = new Map<string, AuthoritativeWorkoutSession>();

  return {
    appendGymQrScan: async () => undefined,
    appendHeartRateSample: async () => undefined,
    cancelSession: async (sessionId) => {
      const session = requireDemoSession(sessions, sessionId);
      const cancelled = {
        ...session,
        completedAt: new Date().toISOString(),
        status: 'cancelled' as const
      };
      sessions.set(sessionId, cancelled);
      return cancelled;
    },
    completeSession: async (sessionId, clientCompletedAt) => {
      const session = requireDemoSession(sessions, sessionId);
      const verified = {
        ...session,
        completedAt: clientCompletedAt ?? new Date().toISOString(),
        eligibleForReview: true,
        status: 'verified' as const,
        violations: []
      };
      sessions.set(sessionId, verified);
      return verified;
    },
    createSession: async (competitionId) => {
      const startedAt = new Date().toISOString();
      const session: AuthoritativeWorkoutSession = {
        completedAt: null,
        competitionId,
        eligibleDate: startedAt.slice(0, 10),
        id: createUuid(),
        policyVersion: 'demo-rules-v1',
        startedAt,
        status: 'active'
      };
      sessions.set(session.id, session);
      return session;
    },
    getCompetitionProgress: async () => null
  };
}

function createUnavailableRepository(): WorkoutSessionRepository {
  const unavailable = () => Promise.reject(
    new Error('The workout session service is not configured.')
  );
  return {
    appendGymQrScan: unavailable,
    appendHeartRateSample: unavailable,
    cancelSession: unavailable,
    completeSession: unavailable,
    createSession: unavailable,
    getCompetitionProgress: async () => null
  };
}

function requireDemoSession(
  sessions: Map<string, AuthoritativeWorkoutSession>,
  sessionId: string
) {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'active') {
    throw new Error('The active demo workout session was not found.');
  }
  return session;
}

function requireApi(api: ApiClient | null) {
  if (!api) throw new Error('The workout session API client is unavailable.');
  return api;
}

function createUuid() {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join('')
  ].join('-');
}
