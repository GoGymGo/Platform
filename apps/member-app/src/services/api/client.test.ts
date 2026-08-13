import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildApiUrl, createApiClient } from '@/services/api/client';

describe('API URL construction', () => {
  it('joins configured base URLs and resource paths once', () => {
    const profilePath = ['', 'v1', 'profile'].join('/');

    assert.equal(
      buildApiUrl('https://api.gogymgo.com/', profilePath),
      'https://api.gogymgo.com/v1/profile'
    );
    assert.equal(
      buildApiUrl('https://api.gogymgo.com', 'v1/profile'),
      'https://api.gogymgo.com/v1/profile'
    );
  });
});

describe('API authentication boundary', () => {
  it('can submit a public request without asking Firebase for a token', async () => {
    const originalFetch = globalThis.fetch;
    let tokenRequests = 0;
    globalThis.fetch = () => Promise.resolve(new Response(null, { status: 204 }));

    try {
      const api = createApiClient({
        baseUrl: 'https://api.gogymgo.com',
        getAccessToken: () => {
          tokenRequests += 1;
          return Promise.resolve('firebase-token');
        }
      });

      await api.request('/v1/public-intake', { authenticated: false });
      assert.equal(tokenRequests, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('surfaces the backend error-envelope message', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({
        error: {
          code: 'SCREEN_NAME_TAKEN',
          message: 'That screen name is already in use.'
        }
      }),
      { headers: { 'content-type': 'application/json' }, status: 409 }
    );

    try {
      const api = createApiClient({
        baseUrl: 'https://api.example.com',
        getAccessToken: async () => 'token'
      });

      await assert.rejects(
        api.request('/v1/me'),
        /That screen name is already in use\./
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retries one rejected bearer token with a forced Firebase refresh', async () => {
    const originalFetch = globalThis.fetch;
    const authorizationHeaders: (string | null)[] = [];
    const tokenRefreshes: (boolean | undefined)[] = [];
    globalThis.fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      authorizationHeaders.push(headers.get('authorization'));
      return authorizationHeaders.length === 1
        ? new Response(JSON.stringify({ message: 'Expired token.' }), {
            headers: { 'content-type': 'application/json' },
            status: 401
          })
        : new Response(JSON.stringify({ id: 'stable-profile' }), {
            headers: { 'content-type': 'application/json' },
            status: 200
          });
    };

    try {
      const api = createApiClient({
        baseUrl: 'https://api.gogymgo.com',
        getAccessToken: async (forceRefresh) => {
          tokenRefreshes.push(forceRefresh);
          return forceRefresh ? 'fresh-token' : 'cached-token';
        }
      });

      await assert.doesNotReject(api.request('/v1/me'));
      assert.deepEqual(tokenRefreshes, [undefined, true]);
      assert.deepEqual(authorizationHeaders, [
        'Bearer cached-token',
        'Bearer fresh-token'
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails closed without replaying when Firebase rejects the forced refresh', async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return new Response(null, { status: 401 });
    };

    try {
      const api = createApiClient({
        baseUrl: 'https://api.gogymgo.com',
        getAccessToken: async (forceRefresh) => {
          if (forceRefresh) {
            throw Object.assign(new Error('Firebase rejected the session.'), {
              code: 'auth/user-token-expired'
            });
          }
          return 'revoked-token';
        }
      });

      await assert.rejects(api.request('/v1/me'), /Firebase rejected the session/);
      assert.equal(requests, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
