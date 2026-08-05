export function extractGymScanCredential(payload: string) {
  const trimmed = payload.trim();
  if (isGymScanCredential(trimmed) && !trimmed.includes('://')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const isProductionWebLink =
      url.protocol === 'https:' &&
      url.hostname === 'app.gogymgo.com' &&
      url.pathname === '/scan';
    const isNativeSchemeLink =
      url.protocol === 'gogymgo:' &&
      ((url.hostname === 'scan' && (url.pathname === '' || url.pathname === '/')) ||
        (url.hostname === '' && url.pathname === '/scan'));

    if (!isProductionWebLink && !isNativeSchemeLink) {
      return null;
    }

    const credential = url.searchParams.get('credential')?.trim() ?? '';
    return isGymScanCredential(credential) ? credential : null;
  } catch {
    return null;
  }
}

export function isGymScanCredential(value: string) {
  return value.length >= 32 && value.length <= 256;
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
