export type IdentityMode = 'private' | 'alias' | 'real';

export type PublicIdentity = {
  callsign: string;
  displayName: string;
  mode: IdentityMode;
};

export const defaultPublicIdentity: PublicIdentity = {
  callsign: 'GHOST_RUNNER',
  displayName: '',
  mode: 'private'
};

export function normalizePublicIdentity(identity: PublicIdentity): PublicIdentity {
  const callsign = identity.callsign.trim() || defaultPublicIdentity.callsign;

  return {
    callsign,
    displayName: identity.displayName.trim(),
    mode: identity.mode
  };
}

export function resolvePublicName(identity: PublicIdentity) {
  const normalized = normalizePublicIdentity(identity);

  if (normalized.mode !== 'private' && normalized.displayName) {
    return normalized.displayName;
  }

  return normalized.callsign;
}

export function getPublicInitials(publicName: string) {
  const parts = publicName
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return (parts[0] ?? 'GG').slice(0, 2).toUpperCase();
}

export function parseStoredPublicIdentity(rawValue: string | null): PublicIdentity | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!isRecord(parsed)) {
      return null;
    }

    const { callsign, displayName, mode } = parsed;
    if (
      typeof callsign !== 'string' ||
      typeof displayName !== 'string' ||
      (mode !== 'private' && mode !== 'alias' && mode !== 'real')
    ) {
      return null;
    }

    return normalizePublicIdentity({ callsign, displayName, mode });
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
