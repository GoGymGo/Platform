import type { CreatorApplicationInput } from '@/domain/creatorApplication';
import { decodePartnerApplicationReceipt } from '@/domain/partnerApplicationReceipt';
import type { ApiClient } from '@/services/api/client';

export function submitCreatorApplication(
  api: ApiClient | null,
  input: CreatorApplicationInput,
  idempotencyKey: string
) {
  if (!api) {
    throw new Error('The GoGymGo API is unavailable.');
  }

  return api
    .request<unknown, CreatorApplicationInput>('/v1/partner-applications/creators', {
      body: input,
      idempotencyKey,
      method: 'POST'
    })
    .then((value) => decodePartnerApplicationReceipt(value, 'creator'));
}
