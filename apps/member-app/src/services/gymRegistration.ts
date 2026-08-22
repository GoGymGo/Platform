import type { GymRegistrationInput } from '@/domain/gymRegistration';
import { decodePartnerApplicationReceipt } from '@/domain/partnerApplicationReceipt';
import type { ApiClient } from '@/services/api/client';

export function recordGymRegistrationRequest(
  api: ApiClient | null,
  input: GymRegistrationInput,
  idempotencyKey: string
) {
  if (!api) {
    throw new Error('The GoGymGo API is unavailable.');
  }

  return api
    .request<unknown, GymRegistrationInput>('/v1/partner-applications/gyms', {
      authenticated: false,
      body: input,
      idempotencyKey,
      method: 'POST'
    })
    .then((value) => decodePartnerApplicationReceipt(value, 'gym'));
}
