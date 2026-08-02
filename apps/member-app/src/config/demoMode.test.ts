import assert from 'node:assert/strict';
import test from 'node:test';

import { isDemoPath } from './demoMode';

test('only the canonical demo route is treated as isolated demo mode', () => {
  assert.equal(isDemoPath('/demo'), true);
  assert.equal(isDemoPath(['', 'demo', 'session'].join('/')), true);
  assert.equal(isDemoPath('/join'), false);
  assert.equal(isDemoPath('/'), false);
  assert.equal(isDemoPath(undefined), false);
});
