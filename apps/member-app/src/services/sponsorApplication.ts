import type { SponsorApplicationInput } from '@/domain/sponsorApplication';
import type { ApiClient } from '@/services/api/client';

export function recordSponsorApplication(
  api: ApiClient | null,
  input: SponsorApplicationInput
) {
  if (api) {
    return api.request('/v1/partner-applications/sponsors', {
      authenticated: false,
      body: input,
      method: 'POST'
    });
  }

  return Promise.resolve({
    ...input,
    recordedAt: new Date().toISOString()
  });
}
