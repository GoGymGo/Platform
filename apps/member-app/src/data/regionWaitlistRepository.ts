import type {
  RegionWaitlistEntryDto,
  RegionWaitlistRequestDto
} from '@gogymgo/contracts';

import type { ApiClient } from '@/services/api/client';

export function submitRegionWaitlist(
  api: ApiClient,
  input: RegionWaitlistRequestDto
): Promise<RegionWaitlistEntryDto> {
  return api.request<RegionWaitlistEntryDto, RegionWaitlistRequestDto>(
    '/v1/region-waitlist',
    {
      authenticated: false,
      body: input,
      method: 'POST'
    }
  );
}
