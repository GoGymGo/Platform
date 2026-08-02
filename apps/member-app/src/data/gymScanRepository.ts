import type { GymScanRequestDto, GymScanResultDto } from '@gogymgo/contracts';

import type { ApiClient } from '@/services/api/client';

export type GymScanRepository = {
  scan: (input: GymScanRequestDto) => Promise<GymScanResultDto>;
};

export function createGymScanRepository(api: ApiClient): GymScanRepository {
  return {
    scan: (input) =>
      api.request<GymScanResultDto, GymScanRequestDto>('/v1/gym-scans', {
        body: input,
        idempotencyKey: `gym-scan-${input.eventId}`,
        method: 'POST'
      })
  };
}
