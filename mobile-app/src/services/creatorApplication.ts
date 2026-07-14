import type { CreatorApplicationInput } from '@/domain/creatorApplication';
import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';

export async function submitCreatorApplication(
  api: ApiClient | null,
  userId: string,
  input: CreatorApplicationInput
) {
  await requireApiClient(api).request('/v1/partner-applications/creators', {
    body: input,
    idempotencyKey: `creator-application:${userId}`,
    method: 'POST'
  });
}
