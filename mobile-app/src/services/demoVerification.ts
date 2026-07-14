import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';
import { demoVerificationRegionCode } from '@/config/demoVerification';

export type DemoCheckInResponse = {
  checkpointType: 'session_start';
  demo: true;
  expiresAt: string;
  id: string;
  issuedAt: string;
  outcome: 'simulated';
  provider: 'canada_demo';
  regionCode: string;
};

export function createDemoCheckIn(api: ApiClient | null) {
  return requireApiClient(api).request<
    DemoCheckInResponse,
    { checkpointType: 'session_start'; regionCode: string }
  >('/v1/demo-verifications/check-ins', {
    body: {
      checkpointType: 'session_start',
      regionCode: demoVerificationRegionCode
    },
    idempotencyKey: `demo-check-in:${Date.now()}`,
    method: 'POST'
  });
}
