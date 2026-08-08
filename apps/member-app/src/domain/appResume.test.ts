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

test('resume prioritizes unfinished setup before every other task', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: true,
      activeWorkoutRoute: '/qr-scanner',
      pendingChallengeInvite: true,
      setupRoute: '/commitment?source=home',
      unclaimedReward: true
    }),
    {
      kind: 'setup',
      route: '/commitment?source=home'
    }
  );
});

test('resume prioritizes an active workout after setup is complete', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: true,
      pendingChallengeInvite: true,
      setupRoute: null,
      unclaimedReward: true
    }),
    {
      kind: 'active-workout',
      route: '/qr-scanner'
    }
  );
});

test('resume sends a player to an unanswered Weekly Challenge invite', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: false,
      pendingChallengeInvite: true,
      setupRoute: null,
      unclaimedReward: true
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
      unclaimedReward: true
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
      unclaimedReward: false
    }),
    null
  );
});
