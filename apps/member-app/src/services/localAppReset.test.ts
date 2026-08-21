import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clearLocalAppData } from './localAppReset';

describe('local app reset', () => {
  it('clears only GoGymGo storage, accessible cookies and caches', async () => {
    const events: string[] = [];
    let cookie = 'gogymgo-session=one; unrelated=two';
    const browserStorage = (keys: string[], scope: string) => ({
      get length() {
        return keys.length;
      },
      key: (index: number) => keys[index] ?? null,
      removeItem: (key: string) => events.push(`${scope}:${key}`)
    });
    const browser = {
      caches: {
        delete: async (key: string) => {
          events.push(`cache:${key}`);
          return true;
        },
        keys: async () => ['gogymgo:app-shell', 'unrelated-images']
      },
      document: {
        get cookie() {
          return cookie;
        },
        set cookie(value: string) {
          events.push(`cookie:${value}`);
          cookie = value;
        }
      },
      localStorage: browserStorage(
        ['gogymgo:profile', 'unrelated-local'],
        'local-storage'
      ),
      sessionStorage: browserStorage(
        ['firebase:authUser:member', 'unrelated-session'],
        'session-storage'
      )
    };

    await clearLocalAppData({
      browser,
      storage: {
        getAllKeys: async () => [
          '@gogymgo/pending-gym-scan',
          '@gogymgo/push-installation-id',
          'firebase:authUser:member',
          'other-app-key'
        ],
        multiRemove: async (keys) => {
          events.push(`async-storage:${keys.join(',')}`);
        }
      }
    });

    assert.deepEqual(events, [
      'async-storage:@gogymgo/pending-gym-scan,@gogymgo/push-installation-id,firebase:authUser:member',
      'local-storage:gogymgo:profile',
      'session-storage:firebase:authUser:member',
      'cookie:gogymgo-session=; Max-Age=0; path=/; SameSite=Lax',
      'cache:gogymgo:app-shell'
    ]);
  });
});
