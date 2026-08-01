import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getWorkoutAccessMode,
  getWorkoutEntryTarget,
  hasSessionCompetitionAccess,
  resolveSessionCompetitionMonthKey
} from './workoutAccess';

describe('workout access policy', () => {
  it('routes incomplete players to setup before workout verification', () => {
    assert.equal(getWorkoutEntryTarget({
      activeSession: false,
      registrationReady: false
    }), 'setup');
    assert.equal(getWorkoutEntryTarget({
      activeSession: false,
      registrationReady: true
    }), 'workout');
    assert.equal(getWorkoutEntryTarget({
      activeSession: true,
      registrationReady: false
    }), 'active-session');
  });

  it('keeps production sessions on the current competition month', () => {
    assert.equal(resolveSessionCompetitionMonthKey({
      currentMonthKey: '2026-07'
    }), '2026-07');
    assert.equal(getWorkoutAccessMode(true), 'upcoming');
  });

  it('requires the authoritative enrollment to match the active competition', () => {
    assert.equal(hasSessionCompetitionAccess({
      competitionId: 'competition-1',
      enrollmentCompetitionId: 'competition-1'
    }), true);
    assert.equal(hasSessionCompetitionAccess({
      competitionId: 'competition-1',
      enrollmentCompetitionId: null
    }), false);
    assert.equal(getWorkoutAccessMode(false), 'active');
  });
});
