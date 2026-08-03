import type {
  CompetitionRegion,
  CompetitionRegionVerification
} from '@/config/regions';

export const appTourRegion: CompetitionRegion = {
  id: 'vancouver-island-gulf-islands-bc',
  label: 'VANCOUVER ISLAND + GULF ISLANDS',
  timeZone: 'America/Vancouver'
};

export const appTourRegionVerification: CompetitionRegionVerification = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  jurisdictionCode: 'CA-BC',
  method: 'device-location',
  region: appTourRegion,
  regionCode: 'vancouver-island-gulf-islands-bc',
  regionPolicyId: '10000000-0000-4000-8000-000000000003',
  status: 'verified',
  verificationId: '10000000-0000-4000-8000-000000000004',
  verifiedAt: '2026-01-01T00:00:00.000Z'
};
