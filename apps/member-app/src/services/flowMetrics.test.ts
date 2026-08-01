import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyFlowMetrics,
  getFlowFunnelSummaries,
  getFlowMetricCounterKey,
  parseFlowMetrics
} from './flowMetrics';

test('flow metrics use allowlisted event and surface names without player data', () => {
  assert.equal(
    getFlowMetricCounterKey('resume-completed', 'home'),
    'home:resume-completed'
  );
});

test('flow metrics recover safely from invalid storage', () => {
  assert.deepEqual(parseFlowMetrics('{not-json'), createEmptyFlowMetrics());
});

test('flow metrics discard invalid counter values', () => {
  assert.deepEqual(
    parseFlowMetrics(JSON.stringify({
      counters: {
        'home:resume-completed': 2,
        invalid: -1,
        text: '5'
      },
      updatedAt: '2026-07-29T00:00:00.000Z',
      version: 99
    })),
    {
      counters: {
        'home:resume-completed': 2
      },
      updatedAt: '2026-07-29T00:00:00.000Z',
      version: 1
    }
  );
});

test('flow metrics summarize started and unfinished funnel counts', () => {
  const summaries = getFlowFunnelSummaries({
    counters: {
      'weekly-goal:weekly-goal-completed': 2,
      'weekly-goal:weekly-goal-viewed': 5,
      'workout:workout-cancelled': 1,
      'workout:workout-completed': 2,
      'workout:workout-started': 4
    },
    updatedAt: null,
    version: 1
  });

  assert.deepEqual(
    summaries.find(({ label }) => label === 'WEEKLY GOAL'),
    {
      completed: 2,
      label: 'WEEKLY GOAL',
      remaining: 3,
      started: 5
    }
  );
  assert.deepEqual(
    summaries.find(({ label }) => label === 'WORKOUT'),
    {
      completed: 3,
      label: 'WORKOUT',
      remaining: 1,
      started: 4
    }
  );
});
