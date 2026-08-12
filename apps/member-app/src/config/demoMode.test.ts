import assert from 'node:assert/strict';
import test from 'node:test';

import { isDemoPath, isDemoSearch } from './demoMode';

test('only the canonical demo route is treated as isolated demo mode', () => {
  assert.equal(isDemoPath('/demo'), true);
  assert.equal(isDemoPath(['', 'demo', 'session'].join('/')), true);
  assert.equal(isDemoPath('/join'), false);
  assert.equal(isDemoPath('/'), false);
  assert.equal(isDemoPath(undefined), false);
});

test('only an explicit demo query activates public demo mode on real routes', () => {
  assert.equal(isDemoSearch('1'), true);
  assert.equal(isDemoSearch('true'), false);
  assert.equal(isDemoSearch('0'), false);
  assert.equal(isDemoSearch(undefined), false);
});
