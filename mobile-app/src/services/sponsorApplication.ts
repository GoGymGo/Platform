import type { SponsorApplicationInput } from '@/domain/sponsorApplication';
import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';

export function recordSponsorApplication(
  api: ApiClient | null,
  input: SponsorApplicationInput
) {
  return requireApiClient(api).request('/v1/partner-applications/sponsors', {
    authenticated: false,
    body: input,
    method: 'POST'
  });
}
