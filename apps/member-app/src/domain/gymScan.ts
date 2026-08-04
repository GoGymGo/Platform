export function extractGymScanCredential(payload: string) {
  const trimmed = payload.trim();
  if (isGymScanCredential(trimmed) && !trimmed.includes('://')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'app.gogymgo.com' || url.pathname !== '/scan') {
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
