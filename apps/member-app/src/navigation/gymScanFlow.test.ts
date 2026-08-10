import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getGymScanPostAuthRoute,
  getGymScanSetupRoute,
  gymScanWorkoutRoute,
  isGymScanContinuation
} from './gymScanFlow';

describe('gym scan navigation', () => {
  it('checks a returning account against the scanned competition and starts new accounts at step one', () => {
    assert.equal(getGymScanPostAuthRoute(false), gymScanWorkoutRoute);
    assert.equal(getGymScanPostAuthRoute(true), '/region?source=gym-scan');
  });

  it('resumes an unregistered scanned competition at the required setup screen', () => {
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
