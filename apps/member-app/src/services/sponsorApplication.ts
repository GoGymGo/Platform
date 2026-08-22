import type { SponsorApplicationInput } from '@/domain/sponsorApplication';
import { decodePartnerApplicationReceipt } from '@/domain/partnerApplicationReceipt';
import type { ApiClient } from '@/services/api/client';

export function recordSponsorApplication(
  api: ApiClient | null,
  input: SponsorApplicationInput,
  idempotencyKey: string
) {
  if (!api) {
    throw new Error('The GoGymGo API is unavailable.');
  }

  return api
    .request<unknown, SponsorApplicationInput>('/v1/partner-applications/sponsors', {
      authenticated: false,
      body: input,
      idempotencyKey,
      method: 'POST'
    })
    .then((value) => decodePartnerApplicationReceipt(value, 'sponsor'));
}
