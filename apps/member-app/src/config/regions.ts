export type CompetitionRegion = {
  id: string;
  label: string;
  timeZone: string;
};

export type CompetitionRegionVerificationMethod = 'device-location';

export type CompetitionRegionVerification = {
  expiresAt: string;
  jurisdictionCode: string;
  method: CompetitionRegionVerificationMethod;
  region: CompetitionRegion;
  regionCode: string;
  regionPolicyId: string;
  status: 'verified';
  verificationId: string;
  verifiedAt: string;
};

export const defaultCompetitionRegion: CompetitionRegion = {
  id: 'unverified',
  label: 'REGION NOT SET',
  timeZone: 'UTC'
};

export function parseCompetitionRegionVerification(
  value: string | null
): CompetitionRegionVerification | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      id?: unknown;
      expiresAt?: unknown;
      jurisdictionCode?: unknown;
      label?: unknown;
      method?: unknown;
      regionCode?: unknown;
      regionPolicyId?: unknown;
      status?: unknown;
      timeZone?: unknown;
      verificationId?: unknown;
      verifiedAt?: unknown;
    };
    const region = parseStoredRegion(parsed);
    const method = parsed.method;

    if (
      !region ||
      method !== 'device-location' ||
      parsed.status !== 'verified' ||
      typeof parsed.expiresAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.expiresAt)) ||
      Date.parse(parsed.expiresAt) <= Date.now() ||
      typeof parsed.jurisdictionCode !== 'string' ||
      !/^[A-Z]{2}-[A-Z0-9-]{1,8}$/.test(parsed.jurisdictionCode) ||
      typeof parsed.regionCode !== 'string' ||
      typeof parsed.regionPolicyId !== 'string' ||
      typeof parsed.verificationId !== 'string' ||
      typeof parsed.verifiedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.verifiedAt))
    ) {
      return null;
    }

    return {
      expiresAt: parsed.expiresAt,
      jurisdictionCode: parsed.jurisdictionCode,
      method,
      region,
      regionCode: parsed.regionCode,
      regionPolicyId: parsed.regionPolicyId,
      status: 'verified',
      verificationId: parsed.verificationId,
      verifiedAt: parsed.verifiedAt
    };
  } catch {
    return null;
  }
}

export function createCompetitionRegion({
  regionCode,
  regionName,
  timezone
}: {
  regionCode: string;
  regionName: string;
  timezone: string;
}): CompetitionRegion {
  const normalizedCode = regionCode.trim();
  const normalizedName = regionName.trim();
  const normalizedTimezone = timezone.trim();

  if (
    !normalizedCode ||
    !normalizedName ||
    !isValidTimeZone(normalizedTimezone)
  ) {
    throw new Error('The server returned invalid contest-region metadata.');
  }

  return {
    id: normalizedCode,
    label: normalizedName.toUpperCase(),
    timeZone: normalizedTimezone
  };
}

function parseStoredRegion(value: unknown): CompetitionRegion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const stored = value as {
    id?: unknown;
    label?: unknown;
    timeZone?: unknown;
  };
  if (
    typeof stored.id !== 'string' ||
    typeof stored.label !== 'string' ||
    typeof stored.timeZone !== 'string' ||
    !stored.id.trim() ||
    !stored.label.trim() ||
    !isValidTimeZone(stored.timeZone)
  ) {
    return null;
  }
  return {
    id: stored.id,
    label: stored.label,
    timeZone: stored.timeZone
  };
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
