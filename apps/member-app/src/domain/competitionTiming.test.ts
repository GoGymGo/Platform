import assert from 'node:assert/strict';
import test from 'node:test';

import { getWorkoutCompletionDeadline } from './competitionTiming';

test('provides the 15-minute competition completion period', () => {
  const endsAt = '2026-09-01T18:00:00.000Z';

  assert.equal(
    getWorkoutCompletionDeadline(endsAt).toISOString(),
    '2026-09-01T18:15:00.000Z'
  );
});
