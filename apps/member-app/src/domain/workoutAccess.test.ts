import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getWorkoutAccessMode,
  getWorkoutEntryLabel,
  getWorkoutEntryTarget,
  getWorkoutSessionContinuity,
  hasSessionCompetitionAccess,
  resolveSessionCompetitionMonthKey
} from './workoutAccess';

describe('workout access policy', () => {
  it('does not offer a new workout while browser session continuity is loading or active', () => {
    assert.equal(getWorkoutSessionContinuity({
      gymScanSessionActive: false,
      gymScanSessionReady: false,
      workoutProgressSessionActive: false
    }), 'checking');
    assert.equal(getWorkoutSessionContinuity({
      gymScanSessionActive: true,
      gymScanSessionReady: true,
      workoutProgressSessionActive: false
    }), 'active-session');
    assert.equal(getWorkoutSessionContinuity({
      gymScanSessionActive: false,
      gymScanSessionReady: true,
      workoutProgressSessionActive: false
    }), 'inactive');
  });

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

  it('labels an active session as a workout in progress', () => {
    assert.equal(getWorkoutEntryLabel({
      activeSession: true,
      setupActionLabel: 'CHOOSE YOUR WEEKLY GOAL',
      setupRequired: false,
      workoutUnavailable: false
    }), 'WORKOUT IN PROGRESS');
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
