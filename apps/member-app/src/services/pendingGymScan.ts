import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GymScanResultDto } from '@gogymgo/contracts';

import { isGymScanCredential } from '@/domain/gymScan';

const pendingGymScanStorageKey = '@gogymgo/pending-gym-scan';
export const pendingGymScanMaxAgeMs = 4 * 60 * 60 * 1000;

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
  credential: string;
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
  const pending = parsePendingGymScan(stored);

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
    credential,
    credentialValidUntil
  }: {
    competitionId: string;
    credential: string;
    credentialValidUntil: string;
  },
  dependencies: PendingGymScanDependencies = {}
) {
  if (!competitionId || !Number.isFinite(Date.parse(credentialValidUntil))) {
    throw new Error('A competition and valid gym access window are required.');
  }

  const storage = dependencies.storage ?? AsyncStorage;
  const pending = await rememberGymScanCredential(credential, {
    ...dependencies,
    storage
  });
  const nextPending: PendingGymScan = {
    ...pending,
    competitionId,
    credentialValidUntil
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
    activeSession:
      result.outcome === 'started' || result.outcome === 'too_early'
        ? activeSession ?? pending.activeSession
        : null
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
    if (
      typeof parsed.credential !== 'string' ||
      !isGymScanCredential(parsed.credential) ||
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
      credentialValidUntil:
        typeof parsed.credentialValidUntil === 'string' &&
        Number.isFinite(Date.parse(parsed.credentialValidUntil))
          ? parsed.credentialValidUntil
          : null,
      createdAt: parsed.createdAt,
      credential: parsed.credential
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
