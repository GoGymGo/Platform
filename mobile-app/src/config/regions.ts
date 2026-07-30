export type CompetitionRegion = {
  id: string;
  label: string;
  timeZone: string;
};

export type CompetitionRegionVerificationMethod = 'device-location';
export type CompetitionRegionVerificationStatus = 'verified' | 'provisional';

export type CompetitionRegionVerification = {
  method: CompetitionRegionVerificationMethod;
  region: CompetitionRegion;
  regionCode: string | null;
  regionPolicyId: string | null;
  status: CompetitionRegionVerificationStatus;
  verificationId: string | null;
  verifiedAt: string;
};

export const competitionRegions: readonly CompetitionRegion[] = [
  { id: 'toronto', label: 'TORONTO', timeZone: 'America/Toronto' },
  { id: 'vancouver', label: 'VANCOUVER', timeZone: 'America/Vancouver' },
  { id: 'calgary', label: 'CALGARY', timeZone: 'America/Edmonton' },
  { id: 'montreal', label: 'MONTREAL', timeZone: 'America/Toronto' }
];

export const defaultCompetitionRegion: CompetitionRegion = {
  id: 'unverified',
  label: 'REGION NOT SET',
  timeZone: 'UTC'
};

export function parseCompetitionRegion(value: string | null) {
  if (!value) {
    return defaultCompetitionRegion;
  }

  try {
    const parsed = JSON.parse(value) as { id?: unknown };
    return competitionRegions.find((region) => region.id === parsed.id)
      ?? defaultCompetitionRegion;
  } catch {
    return defaultCompetitionRegion;
  }
}

export function parseCompetitionRegionVerification(
  value: string | null
): CompetitionRegionVerification | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      id?: unknown;
      method?: unknown;
      regionCode?: unknown;
      regionPolicyId?: unknown;
      status?: unknown;
      verificationId?: unknown;
      verifiedAt?: unknown;
    };
    const region = competitionRegions.find((candidate) => candidate.id === parsed.id);
    const method = parsed.method;

    if (
      !region ||
      method !== 'device-location' ||
      (parsed.status !== 'verified' && parsed.status !== 'provisional') ||
      typeof parsed.verifiedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.verifiedAt))
    ) {
      return null;
    }

    return {
      method,
      region,
      regionCode: typeof parsed.regionCode === 'string' ? parsed.regionCode : null,
      regionPolicyId: typeof parsed.regionPolicyId === 'string' ? parsed.regionPolicyId : null,
      status: parsed.status,
      verificationId: typeof parsed.verificationId === 'string' ? parsed.verificationId : null,
      verifiedAt: parsed.verifiedAt
    };
  } catch {
    return null;
  }
}
