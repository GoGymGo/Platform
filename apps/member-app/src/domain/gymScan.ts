export function extractGymScanCredential(payload: unknown) {
  if (typeof payload !== 'string') {
    return null;
  }
  const trimmed = payload.trim();
  if (isGymScanCredential(trimmed) && !trimmed.includes('://')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hasExactCredentialQuery =
      [...url.searchParams.keys()].length === 1 &&
      url.searchParams.getAll('credential').length === 1;
    const hasUnsafeUrlParts = Boolean(
      url.username || url.password || url.hash || url.port
    );
    const isProductionWebLink =
      url.protocol === 'https:' &&
      url.hostname === 'app.gogymgo.com' &&
      url.pathname === '/scan';
    const isNativeSchemeLink =
      url.protocol === 'gogymgo:' &&
      ((url.hostname === 'scan' && (url.pathname === '' || url.pathname === '/')) ||
        (url.hostname === '' && url.pathname === '/scan'));

    if (
      hasUnsafeUrlParts ||
      !hasExactCredentialQuery ||
      (!isProductionWebLink && !isNativeSchemeLink)
    ) {
      return null;
    }

    const credential = url.searchParams.get('credential')?.trim() ?? '';
    if (!isGymScanCredential(credential)) {
      return null;
    }
    const canonicalPayloads = isProductionWebLink
      ? [`https://app.gogymgo.com/scan?credential=${credential}`]
      : [
          `gogymgo://scan?credential=${credential}`,
          `gogymgo:///scan?credential=${credential}`
        ];
    return canonicalPayloads.includes(trimmed) ? credential : null;
  } catch {
    return null;
  }
}

export function isGymScanCredential(value: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export function extractGymScanRouteCredential(
  parameters: Record<string, string | string[] | undefined>
) {
  const keys = Object.keys(parameters);
  if (keys.length !== 1 || keys[0] !== 'credential') {
    return null;
  }
  return extractGymScanCredential(parameters.credential);
}

export function normalizeGymScanAccuracyMeters(accuracyMeters: number | null) {
  if (accuracyMeters === null || !Number.isFinite(accuracyMeters)) {
    return null;
  }

  const roundedUp = Math.ceil(accuracyMeters * 1_000) / 1_000;
  return Math.min(1_000, Math.max(0.1, roundedUp));
}

export function isGymLocationAccuracyValidationMessage(message: string) {
  return /(?:gymPresence\.)?accuracyMeters\s+must\s+be/i.test(message);
}

export function getGymScanRemainingSeconds(
  minimumCompleteAt: string | null | undefined,
  fallbackSeconds: number,
  now: number | null
) {
  if (!minimumCompleteAt || now === null) {
    return Math.max(0, fallbackSeconds);
  }

  const target = Date.parse(minimumCompleteAt);
  return Number.isFinite(target)
    ? Math.max(0, Math.ceil((target - now) / 1000))
    : Math.max(0, fallbackSeconds);
}

export function isGymScanCompletionReady(
  minimumCompleteAt: string | null | undefined,
  now: number
) {
  const target = minimumCompleteAt ? Date.parse(minimumCompleteAt) : Number.NaN;
  return Number.isFinite(target) && now >= target;
}
