import type { AppDataMode } from '@/data/appData';
import type {
  AuthoritativeWorkoutSession,
  CompetitionProgress,
  StartedWorkoutSession,
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
  appendPresenceCheck: (
    sessionId: string,
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
  ) => Promise<StartedWorkoutSession>;
  getCompetitionProgress: () => Promise<CompetitionProgress | null>;
};

export function createWorkoutSessionRepository(
  mode: AppDataMode,
  api: ApiClient | null
): WorkoutSessionRepository {
  if (mode === 'api') return createApiRepository(requireApi(api));
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
    appendPresenceCheck: (sessionId, occurredAt) => {
      const eventId = createUuid();
      return api.request<unknown, {
        eventId: string;
        eventType: 'presence_check';
        occurredAt: string;
      }>(`/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
        body: {
          eventId,
          eventType: 'presence_check',
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
      api.request<StartedWorkoutSession, { competitionId: string }>(
        '/v1/sessions', {
        body: { competitionId },
        idempotencyKey: `session-create-${commandId}`,
        method: 'POST'
      }),
    getCompetitionProgress: () => api.request<unknown>(
      '/v1/me/progress'
    ).then(normalizeCompetitionProgress)
  };
}

function createUnavailableRepository(): WorkoutSessionRepository {
  const unavailable = () => Promise.reject(
    new Error('The workout session service is not configured.')
  );
  return {
    appendGymQrScan: unavailable,
    appendHeartRateSample: unavailable,
    appendPresenceCheck: unavailable,
    cancelSession: unavailable,
    completeSession: unavailable,
    createSession: unavailable,
    getCompetitionProgress: async () => null
  };
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

function normalizeCompetitionProgress(
  value: unknown
): CompetitionProgress | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isNonnegativeInteger(value.bankedPrizeDrawEntries) ||
    !isNonnegativeInteger(value.categoryScore) ||
    typeof value.competitionId !== 'string' ||
    !isCompetitionStatus(value.competitionStatus) ||
    typeof value.enrolledDateKey !== 'string' ||
    !isIntegerInRange(value.goalDays, 1, 7) ||
    typeof value.monthKey !== 'string' ||
    !isNonnegativeInteger(value.prizeDrawEntries) ||
    !isNonnegativeInteger(value.projectedPrizeDrawEntries) ||
    value.prizeDrawEntries !== value.bankedPrizeDrawEntries ||
    value.projectedPrizeDrawEntries < value.bankedPrizeDrawEntries ||
    typeof value.referenceDateKey !== 'string' ||
    typeof value.rulesVersion !== 'string' ||
    !isScoringStatus(value.scoringStatus) ||
    (value.scoringStatus === 'final' &&
      value.projectedPrizeDrawEntries !== value.bankedPrizeDrawEntries) ||
    typeof value.serverTime !== 'string' ||
    !isIntegerInRange(value.settledPeriodCount, 0, 4) ||
    typeof value.updatedAt !== 'string' ||
    !Array.isArray(value.verifiedDateKeys) ||
    !value.verifiedDateKeys.every((dateKey) => typeof dateKey === 'string') ||
    !isNonnegativeInteger(value.verifiedDays) ||
    value.verifiedDays !== value.verifiedDateKeys.length ||
    value.verifiedDays !== new Set(value.verifiedDateKeys).size ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isCompetitionSessionSummary)
  ) {
    throw new Error('The competition progress response is invalid.');
  }

  return value as CompetitionProgress;
}

function isCompetitionSessionSummary(value: unknown) {
  return (
    isRecord(value) &&
    (value.completedAt === null || typeof value.completedAt === 'string') &&
    typeof value.eligibleDate === 'string' &&
    typeof value.id === 'string' &&
    typeof value.startedAt === 'string' &&
    isWorkoutSessionStatus(value.status)
  );
}

function isWorkoutSessionStatus(
  value: unknown
): value is AuthoritativeWorkoutSession['status'] {
  return (
    value === 'active' ||
    value === 'cancelled' ||
    value === 'pending_review' ||
    value === 'rejected' ||
    value === 'verified'
  );
}

function isCompetitionStatus(
  value: unknown
): value is CompetitionProgress['competitionStatus'] {
  return (
    value === 'active' || value === 'registration' || value === 'settled' || value === 'settling'
  );
}

function isScoringStatus(value: unknown): value is CompetitionProgress['scoringStatus'] {
  return value === 'final' || value === 'provisional';
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number) {
  return isNonnegativeInteger(value) && value >= minimum && value <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
