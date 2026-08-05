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
