import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';
import { bcDemoRegionCode } from '@/services/regionFoundation';

type OperatorWorkQueueItem = {
  createdAt: string;
  id: string;
  kind: string;
  regionCode?: string;
  status: string;
  verificationMethod?: string;
};

export type BcRegionReview = {
  createdAt: string;
  id: string;
  regionCode: string;
  status: 'pending';
  verificationMethod: 'device_location' | 'manual_review' | 'postal_code';
};

export async function listPendingBcRegionReviews(
  api: ApiClient | null
): Promise<BcRegionReview[]> {
  const queue = await requireApiClient(api).request<readonly OperatorWorkQueueItem[]>(
    '/v1/operator/work-queue'
  );
  return queue
    .filter(
      (item): item is OperatorWorkQueueItem & {
        regionCode: string;
        verificationMethod: BcRegionReview['verificationMethod'];
      } =>
        item.kind === 'region_verification' &&
        item.regionCode === bcDemoRegionCode &&
        ['device_location', 'manual_review', 'postal_code'].includes(
          item.verificationMethod ?? ''
        ) &&
        item.status === 'pending'
    )
    .map((item) => ({
      createdAt: item.createdAt,
      id: item.id,
      regionCode: item.regionCode,
      status: 'pending',
      verificationMethod: item.verificationMethod
    }));
}

export function decideBcRegionReview(
  api: ApiClient | null,
  reviewId: string,
  decision: 'approved' | 'rejected',
  reason: string
) {
  const body = { decision, reason: reason.trim() };
  return requireApiClient(api).request<
    { id: string; status: 'approved' | 'rejected' },
    typeof body
  >(`/v1/operator/region-verifications/${reviewId}/decision`, {
    body,
    idempotencyKey: `bc-region-review:${reviewId}:${decision}`,
    method: 'POST'
  });
}
