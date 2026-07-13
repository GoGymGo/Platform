import type { ApiClient } from '@/services/api/client';

export class ApiUnavailableError extends Error {
  constructor() {
    super('The GoGymGo API is not configured for this build.');
    this.name = 'ApiUnavailableError';
  }
}

export function requireApiClient(api: ApiClient | null): ApiClient {
  if (!api) {
    throw new ApiUnavailableError();
  }

  return api;
}

export function isApiUnavailableError(error: unknown): error is ApiUnavailableError {
  return error instanceof ApiUnavailableError;
}
