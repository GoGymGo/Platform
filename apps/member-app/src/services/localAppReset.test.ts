import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clearLocalAppData } from './localAppReset';

describe('local app reset', () => {
  it('clears app storage, browser storage, accessible cookies and caches', async () => {
    const events: string[] = [];
    let cookie = 'session=one; preference=two';
    const browser = {
      caches: {
        delete: async (key: string) => {
          events.push(`cache:${key}`);
          return true;
        },
        keys: async () => ['app-shell', 'images']
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
      localStorage: { clear: () => events.push('local-storage') },
      sessionStorage: { clear: () => events.push('session-storage') }
    };

    await clearLocalAppData({
      browser,
      storage: {
        clear: async () => {
          events.push('async-storage');
        }
      }
    });

    assert.deepEqual(events, [
      'async-storage',
      'local-storage',
      'session-storage',
      'cookie:session=; Max-Age=0; path=/; SameSite=Lax',
      'cookie:preference=; Max-Age=0; path=/; SameSite=Lax',
      'cache:app-shell',
      'cache:images'
    ]);
  });
});
