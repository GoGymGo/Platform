import type { GymRegistrationInput } from '@/domain/gymRegistration';
import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';

export function recordGymRegistrationRequest(
  api: ApiClient | null,
  input: GymRegistrationInput
) {
  return requireApiClient(api).request('/v1/partner-applications/gyms', {
    authenticated: false,
    body: input,
    method: 'POST'
  });
}
