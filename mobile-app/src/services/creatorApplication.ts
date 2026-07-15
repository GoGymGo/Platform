import type { CreatorApplicationInput } from '@/domain/creatorApplication';
import type { ApiClient } from '@/services/api/client';
import { createUserStorage } from '@/services/storage/userStorage';

const creatorApplicationKey = '@gogymgo/creator-application';

export async function submitCreatorApplication(
  api: ApiClient | null,
  userId: string,
  input: CreatorApplicationInput
) {
  if (api) {
    await api.request('/v1/partner-applications/creators', {
      body: input,
      idempotencyKey: `creator-application:${userId}`,
      method: 'POST'
    });
    return;
  }

  await createUserStorage(userId).setItem(
    creatorApplicationKey,
    JSON.stringify({
      ...input,
      submittedAt: new Date().toISOString()
    })
  );
}
