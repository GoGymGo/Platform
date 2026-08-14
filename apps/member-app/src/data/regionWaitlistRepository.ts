import type {
  MemberRegionWaitlistRequestDto,
  RegionWaitlistReceiptDto
} from '@gogymgo/contracts';

import type { ApiClient } from '@/services/api/client';

export const regionalUpdatesConsentNoticeVersion =
  'regional-updates-2026-08-13-v1' as const;

export function submitRegionWaitlist(
  api: ApiClient,
  input: Omit<MemberRegionWaitlistRequestDto, 'consentNoticeVersion'>
): Promise<RegionWaitlistReceiptDto> {
  return api.request<RegionWaitlistReceiptDto, MemberRegionWaitlistRequestDto>(
    '/v1/me/region-waitlist',
    {
      body: {
        ...input,
        consentNoticeVersion: regionalUpdatesConsentNoticeVersion
      },
      method: 'POST'
    }
  );
}
