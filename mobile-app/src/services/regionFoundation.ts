import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';

export const bcDemoRegionCode = 'CA-BC-DEMO';

export type BcRegionEvidence =
  | { latitude: number; longitude: number; method: 'device-location' }
  | { method: 'postal-code'; postalCode: string };

type RegionPolicyResponse = {
  code: string;
  competitionEnabled: boolean;
  countryCode: string;
  id: string;
  payoutEnabled: boolean;
  policyVersion: string;
  subdivisionCode: string;
};

export type RegionVerificationResponse = {
  createdAt: string;
  id: string;
  method: 'device_location' | 'postal_code';
  policyVersion: string;
  regionPolicyId: string;
  status: 'approved' | 'expired' | 'pending' | 'rejected';
};

export type CurrentRegionVerificationResponse = RegionVerificationResponse & {
  expiresAt: string | null;
  regionCode: string;
  regionName: string;
  reviewedAt: string | null;
};

export function getCurrentBcRegionVerification(api: ApiClient | null) {
  return requireApiClient(api).request<CurrentRegionVerificationResponse | null>(
    `/v1/me/region-verifications/current?regionCode=${bcDemoRegionCode}`
  );
}

export async function submitBcRegionVerification(
  api: ApiClient | null,
  evidence: BcRegionEvidence
) {
  const client = requireApiClient(api);
  const policies = await client.request<readonly RegionPolicyResponse[]>(
    '/v1/regions',
    { authenticated: false }
  );
  const policy = policies.find((candidate) => candidate.code === bcDemoRegionCode);

  if (!policy) {
    throw new Error('The disabled British Columbia demo policy is not available.');
  }
  if (
    policy.countryCode !== 'CA' ||
    policy.subdivisionCode !== 'BC' ||
    policy.competitionEnabled ||
    policy.payoutEnabled
  ) {
    throw new Error('The British Columbia demo policy is not in its required disabled state.');
  }

  const body = evidence.method === 'device-location'
    ? {
        latitude: evidence.latitude,
        longitude: evidence.longitude,
        method: 'device_location' as const,
        regionPolicyId: policy.id
      }
    : {
        method: 'postal_code' as const,
        postalCode: evidence.postalCode,
        regionPolicyId: policy.id
      };

  return client.request<RegionVerificationResponse, typeof body>(
    '/v1/me/region-verifications',
    {
      body,
      idempotencyKey: `region-verification:${policy.id}:${evidence.method}:${Date.now()}`,
      method: 'POST'
    }
  );
}
