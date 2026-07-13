import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildUserStorageKey } from '@/services/storage/userStorage';

describe('user-scoped storage keys', () => {
  it('isolates the same logical key for different accounts', () => {
    assert.equal(
      buildUserStorageKey('firebase-user-a', '@gogymgo/workout-logs'),
      '@gogymgo/users/firebase-user-a/workout-logs'
    );
    assert.equal(
      buildUserStorageKey('firebase-user-b', '@gogymgo/workout-logs'),
      '@gogymgo/users/firebase-user-b/workout-logs'
    );
  });

  it('normalizes legacy key formats without losing their domain', () => {
    assert.equal(
      buildUserStorageKey('user@example.com', 'gogymgo:legal:biometric-camera-consent'),
      '@gogymgo/users/user%40example.com/legal:biometric-camera-consent'
    );
  });

  it('rejects missing account or logical keys', () => {
    assert.throws(() => buildUserStorageKey('', 'profile'), /user ID/i);
    assert.throws(() => buildUserStorageKey('user-a', ''), /storage key/i);
  });
});
