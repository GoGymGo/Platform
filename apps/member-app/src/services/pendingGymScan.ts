import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GymScanResultDto } from '@gogymgo/contracts';

import { isGymScanCredential } from '@/domain/gymScan';

const pendingGymScanStorageKey = '@gogymgo/pending-gym-scan';
export const pendingGymScanMaxAgeMs = 4 * 60 * 60 * 1000;
const recoverableGymScanRejectionReasons = new Set([
  'inaccurate_location',
  'outside_geofence',
  'replayed_event'
]);

export type PendingGymScanSession = {
  expiresAt: string;
  gymName: string | null;
  minimumCompleteAt: string;
  sessionId: string;
  startedAt: string;
};

export type PendingGymScan = {
  activeSession: PendingGymScanSession | null;
  competitionId: string | null;
  credentialValidUntil: string | null;
  createdAt: number;
  credential: string | null;
};

type PendingGymScanStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

type PendingGymScanDependencies = {
  now?: () => number;
  storage?: PendingGymScanStorage;
};

type PendingGymScanListener = (pending: PendingGymScan | null) => void;

const pendingGymScanListeners = new Set<PendingGymScanListener>();

export function subscribePendingGymScan(listener: PendingGymScanListener) {
  pendingGymScanListeners.add(listener);
  return () => pendingGymScanListeners.delete(listener);
}

export async function readPendingGymScan(
  dependencies: PendingGymScanDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  const now = dependencies.now?.() ?? Date.now();
  const stored = await storage.getItem(pendingGymScanStorageKey);
  let pending = parsePendingGymScan(stored);

  const hasEnrolledCredential = Boolean(pending?.credentialValidUntil);
  const credentialValidUntil = pending?.credentialValidUntil
    ? Date.parse(pending.credentialValidUntil)
    : null;
  const enrolledCredentialExpired =
    hasEnrolledCredential &&
    credentialValidUntil !== null &&
    Number.isFinite(credentialValidUntil) &&
    credentialValidUntil <= now &&
    (!pending?.activeSession || Date.parse(pending.activeSession.expiresAt) <= now);
  const abandonedSelectionExpired =
    !hasEnrolledCredential &&
    pending !== null &&
    now - pending.createdAt > pendingGymScanMaxAgeMs;

  if (
    !pending ||
    pending.createdAt > now + 60_000 ||
    enrolledCredentialExpired ||
    abandonedSelectionExpired
  ) {
    if (stored) {
      await storage.removeItem(pendingGymScanStorageKey);
    }
    return null;
  }

  if (pending.credentialValidUntil && pending.credential !== null) {
    // Migrate legacy enrolled state that retained the intentionally public QR
    // payload. Later workouts use the immutable enrollment, not this token.
    const withoutCredential = { ...pending, credential: null };
    await storage.setItem(
      pendingGymScanStorageKey,
      JSON.stringify(withoutCredential)
    );
    pending = withoutCredential;
  }

  if (pending.activeSession && Date.parse(pending.activeSession.expiresAt) <= now) {
    const withoutExpiredSession = { ...pending, activeSession: null };
    await storage.setItem(pendingGymScanStorageKey, JSON.stringify(withoutExpiredSession));
    return withoutExpiredSession;
  }

  return pending;
}

export async function rememberGymScanCredential(
  credential: string,
  dependencies: PendingGymScanDependencies = {}
) {
  if (!isGymScanCredential(credential)) {
    throw new Error('A valid gym scan credential is required.');
  }

  const storage = dependencies.storage ?? AsyncStorage;
  const now = dependencies.now?.() ?? Date.now();
  const existing = await readPendingGymScan({ ...dependencies, storage });
  const pending: PendingGymScan = {
    activeSession: existing?.credential === credential ? existing.activeSession : null,
    competitionId: existing?.credential === credential ? existing.competitionId : null,
    credentialValidUntil:
      existing?.credential === credential ? existing.credentialValidUntil : null,
    createdAt: now,
    credential
  };
  await storage.setItem(pendingGymScanStorageKey, JSON.stringify(pending));
  notifyPendingGymScan(pending);
  return pending;
}

export async function rememberCompetitionGymAccess(
  {
    competitionId,
    credentialValidUntil
  }: {
    competitionId: string;
    credentialValidUntil: string;
  },
  dependencies: PendingGymScanDependencies = {}
) {
  if (!competitionId || !Number.isFinite(Date.parse(credentialValidUntil))) {
    throw new Error('A competition and valid gym access window are required.');
  }

  const storage = dependencies.storage ?? AsyncStorage;
  const pending = await readPendingGymScan({ ...dependencies, storage });
  if (!pending?.credential) {
    throw new Error('A scanned gym credential is required before enrollment.');
  }
  const nextPending: PendingGymScan = {
    ...pending,
    competitionId,
    credential: null,
    credentialValidUntil
  };
  await storage.setItem(pendingGymScanStorageKey, JSON.stringify(nextPending));
  notifyPendingGymScan(nextPending);
  return nextPending;
}

export async function rememberCompetitionGymScanResult(
  {
    competitionId,
    credentialValidUntil,
    result
  }: {
    competitionId: string;
    credentialValidUntil: string;
    result: GymScanResultDto;
  },
  dependencies: PendingGymScanDependencies = {}
) {
  if (!competitionId || !Number.isFinite(Date.parse(credentialValidUntil))) {
    throw new Error('A competition and valid gym access window are required.');
  }
  const storage = dependencies.storage ?? AsyncStorage;
  const existing = await readPendingGymScan({ ...dependencies, storage });
  const now = dependencies.now?.() ?? Date.now();
  const activeSession = parseActiveSession(result);
  const nextPending: PendingGymScan = {
    activeSession: resolveActiveSessionAfterScan(
      result,
      activeSession ?? existing?.activeSession ?? null
    ),
    competitionId,
    credential: null,
    credentialValidUntil,
    createdAt: existing?.createdAt ?? now
  };
  await storage.setItem(pendingGymScanStorageKey, JSON.stringify(nextPending));
  notifyPendingGymScan(nextPending);
  return nextPending;
}

export async function rememberGymScanResult(
  credential: string,
  result: GymScanResultDto,
  dependencies: PendingGymScanDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  const pending = await rememberGymScanCredential(credential, {
    ...dependencies,
    storage
  });
  if (result.outcome === 'verified' && !pending.credentialValidUntil) {
    await storage.removeItem(pendingGymScanStorageKey);
    notifyPendingGymScan(null);
    return null;
  }
  const activeSession = parseActiveSession(result);
  const nextPending: PendingGymScan = {
    ...pending,
    activeSession: resolveActiveSessionAfterScan(
      result,
      activeSession ?? pending.activeSession
    )
  };
  await storage.setItem(pendingGymScanStorageKey, JSON.stringify(nextPending));
  notifyPendingGymScan(nextPending);
  return nextPending;
}

export async function clearPendingGymScan(
  dependencies: PendingGymScanDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  await storage.removeItem(pendingGymScanStorageKey);
  notifyPendingGymScan(null);
}

export async function clearPendingGymScanSession(
  dependencies: PendingGymScanDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  const pending = await readPendingGymScan({ ...dependencies, storage });
  if (!pending) {
    notifyPendingGymScan(null);
    return null;
  }

  const withoutActiveSession = { ...pending, activeSession: null };
  await storage.setItem(
    pendingGymScanStorageKey,
    JSON.stringify(withoutActiveSession)
  );
  notifyPendingGymScan(withoutActiveSession);
  return withoutActiveSession;
}

function notifyPendingGymScan(pending: PendingGymScan | null) {
  for (const listener of pendingGymScanListeners) {
    listener(pending);
  }
}

function parsePendingGymScan(value: string | null): PendingGymScan | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PendingGymScan>;
    const credentialValidUntil =
      typeof parsed.credentialValidUntil === 'string' &&
      Number.isFinite(Date.parse(parsed.credentialValidUntil))
        ? parsed.credentialValidUntil
        : null;
    const credential =
      typeof parsed.credential === 'string' &&
      isGymScanCredential(parsed.credential)
        ? parsed.credential
        : null;
    if (
      (!credential && !credentialValidUntil) ||
      typeof parsed.createdAt !== 'number' ||
      !Number.isFinite(parsed.createdAt)
    ) {
      return null;
    }

    return {
      activeSession: parseStoredActiveSession(parsed.activeSession),
      competitionId:
        typeof parsed.competitionId === 'string' && parsed.competitionId
          ? parsed.competitionId
          : null,
      credentialValidUntil,
      createdAt: parsed.createdAt,
      credential
    };
  } catch {
    return null;
  }
}

function parseActiveSession(result: GymScanResultDto) {
  return parseStoredActiveSession({
    expiresAt: result.expiresAt,
    gymName: result.gymName,
    minimumCompleteAt: result.minimumCompleteAt,
    sessionId: result.sessionId,
    startedAt: result.startedAt
  });
}

function resolveActiveSessionAfterScan(
  result: GymScanResultDto,
  activeSession: PendingGymScanSession | null
) {
  if (result.outcome === 'started' || result.outcome === 'too_early') {
    return activeSession;
  }
  if (
    result.outcome === 'rejected' &&
    result.rejectionReason &&
    recoverableGymScanRejectionReasons.has(result.rejectionReason)
  ) {
    return activeSession;
  }
  return null;
}

function parseStoredActiveSession(value: unknown): PendingGymScanSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const session = value as Partial<PendingGymScanSession>;
  if (
    typeof session.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    typeof session.minimumCompleteAt !== 'string' ||
    !Number.isFinite(Date.parse(session.minimumCompleteAt)) ||
    typeof session.sessionId !== 'string' ||
    !session.sessionId ||
    typeof session.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(session.startedAt))
  ) {
    return null;
  }

  return {
    expiresAt: session.expiresAt,
    gymName: typeof session.gymName === 'string' ? session.gymName : null,
    minimumCompleteAt: session.minimumCompleteAt,
    sessionId: session.sessionId,
    startedAt: session.startedAt
  };
}
