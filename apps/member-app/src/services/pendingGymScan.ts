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

export async function readPendingGymScan(
  dependencies: PendingGymScanDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  const now = dependencies.now?.() ?? Date.now();
  const stored = await storage.getItem(pendingGymScanStorageKey);
  const pending = parsePendingGymScan(stored);

  if (!pending || pending.createdAt > now + 60_000 || now - pending.createdAt > pendingGymScanMaxAgeMs) {
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
    createdAt: now,
    credential
  };
  await storage.setItem(pendingGymScanStorageKey, JSON.stringify(pending));
  return pending;
}

export async function rememberGymScanResult(
  credential: string,
  result: GymScanResultDto,
  dependencies: PendingGymScanDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  if (result.outcome === 'verified') {
    await storage.removeItem(pendingGymScanStorageKey);
    return null;
  }

  const pending = await rememberGymScanCredential(credential, {
    ...dependencies,
    storage
  });
  const activeSession = parseActiveSession(result);
  const nextPending: PendingGymScan = {
    ...pending,
    activeSession:
      result.outcome === 'started' || result.outcome === 'too_early'
        ? activeSession ?? pending.activeSession
        : null
  };
  await storage.setItem(pendingGymScanStorageKey, JSON.stringify(nextPending));
  return nextPending;
}

export async function clearPendingGymScan(
  dependencies: PendingGymScanDependencies = {}
) {
  await (dependencies.storage ?? AsyncStorage).removeItem(pendingGymScanStorageKey);
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
