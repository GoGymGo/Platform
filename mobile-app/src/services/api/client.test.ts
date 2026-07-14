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
});
