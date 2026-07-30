import assert from 'node:assert/strict';
import test from 'node:test';

import { getAppResumeTarget } from './appResume';

test('resume prioritizes unfinished setup before every other task', () => {
  assert.deepEqual(
    getAppResumeTarget({
      activeWorkout: true,
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
      route: '/workout/active'
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
