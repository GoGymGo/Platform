import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { User } from 'firebase/auth';

import {
  mapFirebaseUser,
  refreshFirebaseUser,
  sendInitialVerificationEmail
} from '@/services/auth/firebaseIdentity';

function createFirebaseUser(overrides: Partial<Pick<User, 'emailVerified' | 'getIdToken'>> = {}) {
  return {
    displayName: 'Test Player',
    email: 'player@example.com',
    emailVerified: false,
    getIdToken: async () => 'cached-token',
    photoURL: null,
    providerData: [{ providerId: 'password' }],
    uid: 'firebase-user',
    ...overrides
  } as unknown as User;
}

describe('Firebase account identity', () => {
  it('maps only the client identity fields the member app needs', () => {
    assert.deepEqual(mapFirebaseUser(createFirebaseUser()), {
      displayName: 'Test Player',
      email: 'player@example.com',
      emailVerified: false,
      photoUrl: null,
      providerIds: ['password'],
      uid: 'firebase-user'
    });
  });

  it('reloads the authoritative user and forces a fresh token before returning', async () => {
    const events: string[] = [];
    const user = createFirebaseUser({
      getIdToken: async (forceRefresh) => {
        events.push(`token:${String(forceRefresh)}`);
        return 'fresh-token';
      }
    });

    const refreshed = await refreshFirebaseUser(user, async (currentUser) => {
      events.push('reload');
      Object.defineProperty(currentUser, 'emailVerified', { value: true });
    });

    assert.deepEqual(events, ['reload', 'token:true']);
    assert.equal(refreshed.emailVerified, true);
  });

  it('fails closed when a disabled or revoked session cannot refresh', async () => {
    for (const code of ['auth/user-disabled', 'auth/user-token-expired']) {
      const user = createFirebaseUser({
        getIdToken: async () => {
          throw Object.assign(new Error('Firebase rejected the session.'), {
            code
          });
        }
      });

      await assert.rejects(
        refreshFirebaseUser(user, async () => undefined),
        (error: unknown) => error instanceof Error && 'code' in error && error.code === code
      );
    }
  });

  it('reports the authoritative initial verification-email delivery outcome', async () => {
    const user = createFirebaseUser();

    assert.equal(await sendInitialVerificationEmail(user, async () => undefined), true);
    assert.equal(
      await sendInitialVerificationEmail(user, async () => {
        throw new Error('Email delivery unavailable.');
      }),
      false
    );
  });
});
