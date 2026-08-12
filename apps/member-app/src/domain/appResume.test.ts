import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAppResumeRequestStatus,
  getAppResumeTarget
} from './appResume';

test('resume uses a known local target even when background checks fail', () => {
  assert.deepEqual(
    getAppResumeRequestStatus({
      hasImmediateTarget: true,
      registrationError: true,
      registrationLoading: false,
      secondaryError: true,
      secondaryLoading: false
    }),
    {
      error: false,
      loading: false
    }
  );
});

test('resume reports failed checks when no local target is known', () => {
  assert.deepEqual(
    getAppResumeRequestStatus({
      hasImmediateTarget: false,
      registrationError: true,
      registrationLoading: false,
      secondaryError: false,
      secondaryLoading: false
    }),
    {
      error: true,
      loading: false
    }
  );
});

test('optional invitation and Award failures never block Home', () => {
  assert.deepEqual(
    getAppResumeRequestStatus({
      hasImmediateTarget: false,
      registrationError: false,
      registrationLoading: false,
      secondaryError: true,
      secondaryLoading: false
    }),
    {
      error: false,
      loading: false
    }
  );
});

test('resume prioritizes an active workout before every other task', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: true,
      activeWorkoutRoute: '/qr-scanner',
      pendingChallengeInvite: true,
      setupRoute: '/commitment?source=home',
      unclaimedReward: true,
      unseenCompetitionResults: true
    }),
    {
      kind: 'active-workout',
      route: '/qr-scanner'
    }
  );
});

test('resume presents completed contest results before restarting setup', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: false,
      pendingChallengeInvite: true,
      setupRoute: '/region?source=home',
      unclaimedReward: true,
      unseenCompetitionResults: true
    }),
    {
      kind: 'winners-circle',
      route: '/winners-circle?auto=1'
    }
  );
});

test('resume returns to unfinished setup when there are no new results', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: false,
      pendingChallengeInvite: true,
      setupRoute: '/commitment?source=home',
      unclaimedReward: true,
      unseenCompetitionResults: false
    }),
    {
      kind: 'setup',
      route: '/commitment?source=home'
    }
  );
});

test('resume sends a player to an unanswered Weekly Challenge invite', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: false,
      pendingChallengeInvite: true,
      setupRoute: null,
      unclaimedReward: true,
      unseenCompetitionResults: false
    }),
    {
      kind: 'pending-challenge-invite',
      route: '/squad'
    }
  );
});

test('resume sends a player to an unclaimed reward after higher-priority work', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: false,
      pendingChallengeInvite: false,
      setupRoute: null,
      unclaimedReward: true,
      unseenCompetitionResults: false
    }),
    {
      kind: 'unclaimed-reward',
      route: '/rewards/awards'
    }
  );
});

test('resume returns null when no task needs attention', () => {
  assert.equal(
    getAppResumeTarget({
      activeWorkout: false,
      pendingChallengeInvite: false,
      setupRoute: null,
      unclaimedReward: false,
      unseenCompetitionResults: false
    }),
    null
  );
});
