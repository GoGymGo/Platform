import type {
  CompetitionRegion,
  CompetitionRegionVerification
} from '@/config/regions';

export const appTourRegion: CompetitionRegion = {
  id: 'toronto-on',
  label: 'TORONTO',
  timeZone: 'America/Toronto'
};

export const appTourRegionVerification: CompetitionRegionVerification = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  jurisdictionCode: 'CA-ON',
  method: 'device-location',
  region: appTourRegion,
  regionCode: 'toronto-on',
  regionPolicyId: '10000000-0000-4000-8000-000000000003',
  status: 'verified',
  verificationId: '10000000-0000-4000-8000-000000000004',
  verifiedAt: '2026-01-01T00:00:00.000Z'
};
