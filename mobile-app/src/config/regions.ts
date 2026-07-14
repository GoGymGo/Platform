export type CompetitionRegion = {
  id: string;
  label: string;
  timeZone: string;
};

export type CompetitionRegionVerificationMethod = 'device-location' | 'postal-code';
export type CompetitionRegionVerificationStatus =
  | 'approved'
  | 'expired'
  | 'pending'
  | 'rejected';

export type CompetitionRegionVerification = {
  backendVerificationId: string;
  expiresAt: string | null;
  method: CompetitionRegionVerificationMethod;
  policyVersion: string;
  region: CompetitionRegion;
  reviewedAt: string | null;
  status: CompetitionRegionVerificationStatus;
  submittedAt: string;
};

export const competitionRegions: readonly CompetitionRegion[] = [
  { id: 'bc', label: 'BRITISH COLUMBIA', timeZone: 'America/Vancouver' }
];

export const defaultCompetitionRegion = competitionRegions[0];

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
      backendVerificationId?: unknown;
      expiresAt?: unknown;
      id?: unknown;
      method?: unknown;
      policyVersion?: unknown;
      reviewedAt?: unknown;
      status?: unknown;
      submittedAt?: unknown;
    };
    const region = competitionRegions.find((candidate) => candidate.id === parsed.id);
    const method = parsed.method;

    if (
      !region ||
      (method !== 'device-location' && method !== 'postal-code') ||
      !['approved', 'expired', 'pending', 'rejected'].includes(
        parsed.status as string
      ) ||
      typeof parsed.backendVerificationId !== 'string' ||
      typeof parsed.policyVersion !== 'string' ||
      !(parsed.expiresAt === null || typeof parsed.expiresAt === 'string') ||
      !(parsed.reviewedAt === null || typeof parsed.reviewedAt === 'string') ||
      typeof parsed.submittedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.submittedAt))
    ) {
      return null;
    }

    return {
      backendVerificationId: parsed.backendVerificationId,
      expiresAt: parsed.expiresAt,
      method,
      policyVersion: parsed.policyVersion,
      region,
      reviewedAt: parsed.reviewedAt,
      status: parsed.status as CompetitionRegionVerificationStatus,
      submittedAt: parsed.submittedAt
    };
  } catch {
    return null;
  }
}
