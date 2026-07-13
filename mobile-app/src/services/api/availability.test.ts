import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ApiUnavailableError,
  isApiUnavailableError,
  requireApiClient
} from '@/services/api/availability';
import type { ApiClient } from '@/services/api/client';

describe('API availability boundary', () => {
  it('rejects writes when the API is not configured', () => {
    assert.throws(() => requireApiClient(null), ApiUnavailableError);
  });

  it('returns the configured client unchanged', () => {
    const api: ApiClient = {
      request: <TResponse>() => Promise.resolve(null as TResponse)
    };

    assert.equal(requireApiClient(api), api);
    assert.equal(isApiUnavailableError(new ApiUnavailableError()), true);
    assert.equal(isApiUnavailableError(new Error('network')), false);
  });
});
