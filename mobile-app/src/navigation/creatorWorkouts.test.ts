import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCreatorWorkoutsReturnTarget } from '@/navigation/creatorWorkouts';

describe('creator workout return routing', () => {
  it('returns each known entry point to its matching screen', () => {
    assert.deepEqual(getCreatorWorkoutsReturnTarget('home'), {
      href: '/home',
      label: 'BACK TO HOME'
    });
    assert.deepEqual(getCreatorWorkoutsReturnTarget('session'), {
      href: '/session',
      label: 'BACK TO SESSION'
    });
    assert.deepEqual(getCreatorWorkoutsReturnTarget('profile'), {
      href: '/profile',
      label: 'BACK TO PROFILE'
    });
  });

  it('falls back to Home for direct or unknown entry points', () => {
    assert.deepEqual(getCreatorWorkoutsReturnTarget(undefined), {
      href: '/home',
      label: 'BACK TO HOME'
    });
    assert.deepEqual(getCreatorWorkoutsReturnTarget('unknown'), {
      href: '/home',
      label: 'BACK TO HOME'
    });
  });
});
