import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiClient } from '@/services/api/client';
import {
  toPublicIdentity,
  updateAccountPublicIdentity
} from '@/services/profile';

describe('account profile client', () => {
  it('maps the backend real-name mode into the mobile identity domain', () => {
    assert.deepEqual(
      toPublicIdentity({
        callsign: 'GG-1234',
        email: 'user@example.test',
        emailVerified: true,
        id: '10000000-0000-4000-8000-000000000001',
        privacySettings: { showRegion: false, showStats: true },
        publicIdentityMode: 'real_name',
        publicName: 'Test User',
        roles: ['user'],
        status: 'active',
        version: 2
      }),
      { callsign: 'GG-1234', displayName: 'Test User', mode: 'real' }
    );
  });

  it('updates only the public identity fields owned by the profile screen', async () => {
    const calls: unknown[] = [];
    const api = {
      request: (path: string, options?: unknown) => {
        calls.push({ options, path });
        return Promise.resolve({});
      }
    } as ApiClient;

    await updateAccountPublicIdentity(api, {
      callsign: 'LOCAL_ALIAS',
      displayName: 'LOCAL_ALIAS',
      mode: 'alias'
    });
    assert.deepEqual(calls, [{
      options: {
        body: { publicIdentityMode: 'alias', publicName: 'LOCAL_ALIAS' },
        method: 'PATCH'
      },
      path: '/v1/me'
    }]);
  });
});
