import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getGymScanPostAuthRoute,
  getGymScanSetupRoute,
  gymScanWorkoutRoute,
  isGymScanContinuation
} from './gymScanFlow';

describe('gym scan navigation', () => {
  it('returns established players to the scanned workout and new players to setup', () => {
    assert.equal(getGymScanPostAuthRoute(false), gymScanWorkoutRoute);
    assert.equal(getGymScanPostAuthRoute(true), '/region?source=gym-scan');
  });

  it('preserves the gym scan source through every missing setup step', () => {
    assert.equal(getGymScanSetupRoute('region'), '/region?source=gym-scan');
    assert.equal(getGymScanSetupRoute('agreements'), '/region?source=gym-scan');
    assert.equal(getGymScanSetupRoute('weekly-goal'), '/commitment?source=gym-scan');
    assert.equal(getGymScanSetupRoute('complete'), null);
  });

  it('recognizes both authenticated and new-account scan continuations', () => {
    assert.equal(isGymScanContinuation('gym-scan'), true);
    assert.equal(isGymScanContinuation('gym-scan-setup'), true);
    assert.equal(isGymScanContinuation('home'), false);
  });
});
