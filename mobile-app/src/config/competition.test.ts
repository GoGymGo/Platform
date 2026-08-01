import assert from 'node:assert/strict';
import test from 'node:test';

import {
  categoryPodiumMultipliers,
  resolveCategoryPodiumMultipliers
} from './competition';

test('uses the published category podium multipliers when they are valid', () => {
  assert.deepEqual(
    resolveCategoryPodiumMultipliers({
      categoryPodiumMultipliers: { 1: 4, 2: 2.5, 3: 1.25 }
    }),
    { 1: 4, 2: 2.5, 3: 1.25 }
  );
});

test('falls back when an older competition response has no scoring rules', () => {
  assert.deepEqual(resolveCategoryPodiumMultipliers(undefined), categoryPodiumMultipliers);
  assert.deepEqual(resolveCategoryPodiumMultipliers({}), categoryPodiumMultipliers);
});

test('falls back when category podium multipliers are incomplete or invalid', () => {
  assert.deepEqual(
    resolveCategoryPodiumMultipliers({
      categoryPodiumMultipliers: { 1: 3, 2: 2 }
    }),
    categoryPodiumMultipliers
  );
  assert.deepEqual(
    resolveCategoryPodiumMultipliers({
      categoryPodiumMultipliers: { 1: 2, 2: 3, 3: 1.5 }
    }),
    categoryPodiumMultipliers
  );
});
