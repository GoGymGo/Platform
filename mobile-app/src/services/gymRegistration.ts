import type { GymRegistrationInput } from '@/domain/gymRegistration';
import type { ApiClient } from '@/services/api/client';

export function recordGymRegistrationRequest(
  api: ApiClient | null,
  input: GymRegistrationInput
) {
  if (api) {
    return api.request('/v1/partner-applications/gyms', {
      authenticated: false,
      body: input,
      method: 'POST'
    });
  }

  return Promise.resolve({
    ...input,
    requestedAt: new Date().toISOString()
  });
}
