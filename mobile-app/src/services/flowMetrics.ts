import { createUserStorage } from '@/services/storage/userStorage';

export const flowMetricEvents = [
  'challenge-invite-responded',
  'challenge-invite-viewed',
  'flow-retry',
  'resume-completed',
  'resume-started',
  'reward-claim-completed',
  'reward-claim-viewed',
  'weekly-goal-completed',
  'weekly-goal-viewed',
  'workout-cancelled',
  'workout-completed',
  'workout-started',
  'workout-resumed'
] as const;

export const flowMetricSurfaces = [
  'home',
  'leaderboard',
  'my-rewards',
  'reward-marketplace',
  'weekly-challenge',
  'weekly-goal',
  'workout',
  'workouts'
] as const;

export type FlowMetricEvent = (typeof flowMetricEvents)[number];
export type FlowMetricSurface = (typeof flowMetricSurfaces)[number];

export type FlowMetrics = {
  counters: Record<string, number>;
  updatedAt: string | null;
  version: 1;
};

export type FlowFunnelSummary = {
  completed: number;
  label: string;
  remaining: number;
  started: number;
};

const storageKey = '@gogymgo/flow-metrics-v1';
const writeQueues = new Map<string, Promise<void>>();

export function createEmptyFlowMetrics(): FlowMetrics {
  return {
    counters: {},
    updatedAt: null,
    version: 1
  };
}

export function getFlowMetricCounterKey(
  event: FlowMetricEvent,
  surface: FlowMetricSurface
) {
  return `${surface}:${event}`;
}

export function parseFlowMetrics(value: string | null): FlowMetrics {
  if (!value) {
    return createEmptyFlowMetrics();
  }

  try {
    const candidate = JSON.parse(value) as Partial<FlowMetrics>;
    const counters = Object.fromEntries(
      Object.entries(candidate.counters ?? {})
        .filter(([key, count]) =>
          key.length <= 96 &&
          Number.isSafeInteger(count) &&
          Number(count) >= 0
        )
        .map(([key, count]) => [key, Number(count)])
    );

    return {
      counters,
      updatedAt:
        typeof candidate.updatedAt === 'string'
          ? candidate.updatedAt
          : null,
      version: 1
    };
  } catch {
    return createEmptyFlowMetrics();
  }
}

export function getFlowFunnelSummaries(
  metrics: FlowMetrics
): readonly FlowFunnelSummary[] {
  const count = (
    event: FlowMetricEvent,
    surface: FlowMetricSurface
  ) => metrics.counters[getFlowMetricCounterKey(event, surface)] ?? 0;

  return [
    buildFunnel(
      'RETURN RESUME',
      count('resume-started', 'home'),
      count('resume-completed', 'home')
    ),
    buildFunnel(
      'WEEKLY GOAL',
      count('weekly-goal-viewed', 'weekly-goal'),
      count('weekly-goal-completed', 'weekly-goal')
    ),
    buildFunnel(
      'WORKOUT',
      count('workout-started', 'workout'),
      count('workout-completed', 'workout') +
        count('workout-cancelled', 'workout')
    ),
    buildFunnel(
      'CHALLENGE INVITE',
      count('challenge-invite-viewed', 'weekly-challenge'),
      count('challenge-invite-responded', 'weekly-challenge')
    ),
    buildFunnel(
      'REWARD CLAIM',
      count('reward-claim-viewed', 'my-rewards'),
      count('reward-claim-completed', 'my-rewards')
    )
  ];
}

export async function recordFlowMetric(
  userId: string | null | undefined,
  event: FlowMetricEvent,
  surface: FlowMetricSurface
) {
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    return;
  }

  const previousWrite = writeQueues.get(normalizedUserId) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch(() => undefined)
    .then(async () => {
      const storage = createUserStorage(normalizedUserId);
      const metrics = parseFlowMetrics(await storage.getItem(storageKey));
      const counterKey = getFlowMetricCounterKey(event, surface);
      metrics.counters[counterKey] = Math.min(
        Number.MAX_SAFE_INTEGER,
        (metrics.counters[counterKey] ?? 0) + 1
      );
      metrics.updatedAt = new Date().toISOString();
      await storage.setItem(storageKey, JSON.stringify(metrics));
    });

  writeQueues.set(normalizedUserId, nextWrite);
  try {
    await nextWrite;
  } finally {
    if (writeQueues.get(normalizedUserId) === nextWrite) {
      writeQueues.delete(normalizedUserId);
    }
  }
}

export async function getFlowMetrics(
  userId: string | null | undefined
): Promise<FlowMetrics> {
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    return createEmptyFlowMetrics();
  }

  const pendingWrite = writeQueues.get(normalizedUserId);
  if (pendingWrite) {
    await pendingWrite.catch(() => undefined);
  }

  const storage = createUserStorage(normalizedUserId);
  return parseFlowMetrics(await storage.getItem(storageKey));
}

function buildFunnel(
  label: string,
  started: number,
  completed: number
): FlowFunnelSummary {
  return {
    completed,
    label,
    remaining: Math.max(0, started - completed),
    started
  };
}
