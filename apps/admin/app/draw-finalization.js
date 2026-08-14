// @ts-check

const seedBytes = 32;
const recoveryLifetimeMs = 30 * 24 * 60 * 60 * 1_000;
const canonicalDigestPattern = /^[a-f0-9]{64}$/;

/**
 * The contest end is the workout-start cutoff anchor. Workouts already in
 * progress receive 15 minutes to finish before results can be finalized.
 *
 * @param {{endsAt: string, status: string}} competition
 * @param {Date} [now]
 */
export function canFinalizeCompetitionResults(competition, now = new Date()) {
  const endsAt = new Date(competition.endsAt);
  return (
    competition.status === "active" &&
    !Number.isNaN(endsAt.getTime()) &&
    now.getTime() >= endsAt.getTime() + 15 * 60 * 1_000
  );
}

/** @param {Crypto} [cryptoProvider] */
export function createDrawSeed(cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.getRandomValues) {
    throw new Error("Secure random-number generation is unavailable.");
  }
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(seedBytes));
  return bytesToHex(bytes);
}

/**
 * @param {string} seedReveal
 * @param {Crypto} [cryptoProvider]
 */
export async function buildDrawSeedCommitment(
  seedReveal,
  cryptoProvider = globalThis.crypto,
) {
  if (!canonicalDigestPattern.test(seedReveal)) {
    throw new Error("The draw seed must be 32 bytes encoded as hexadecimal.");
  }
  if (!cryptoProvider?.subtle) {
    throw new Error("Secure hashing is unavailable.");
  }
  const seed = Uint8Array.from(seedReveal.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
  return bytesToHex(
    new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", seed)),
  );
}

/**
 * @typedef {object} PendingDrawFinalization
 * @property {string} competitionId
 * @property {string} createdAt
 * @property {string} drawId
 * @property {string} environmentOrigin
 * @property {string} expiresAt
 * @property {string} operatorUserId
 * @property {string} seedCommitment
 * @property {string} seedReveal
 */

/**
 * @param {{competitionId: string, environmentOrigin: string, now?: Date, operatorUserId: string, seedCommitment: string, seedReveal: string}} input
 * @returns {PendingDrawFinalization}
 */
export function createPendingDrawFinalization(input) {
  const now = input.now ?? new Date();
  if (
    !input.competitionId ||
    !input.environmentOrigin ||
    !input.operatorUserId ||
    !canonicalDigestPattern.test(input.seedCommitment) ||
    !canonicalDigestPattern.test(input.seedReveal)
  ) {
    throw new Error("The pending draw recovery record is invalid.");
  }
  return {
    competitionId: input.competitionId,
    createdAt: now.toISOString(),
    drawId: "",
    environmentOrigin: input.environmentOrigin,
    expiresAt: new Date(now.getTime() + recoveryLifetimeMs).toISOString(),
    operatorUserId: input.operatorUserId,
    seedCommitment: input.seedCommitment,
    seedReveal: input.seedReveal,
  };
}

/** @param {string} operatorUserId @param {string} environmentOrigin */
export function pendingDrawRecoveryStorageKey(
  operatorUserId,
  environmentOrigin,
) {
  return `gogymgo.admin.pending-draw-finalization.v2:${encodeURIComponent(environmentOrigin)}:${encodeURIComponent(operatorUserId)}`;
}

/**
 * @param {Storage} storage
 * @param {string} operatorUserId
 * @param {string} environmentOrigin
 * @param {Date} [now]
 * @returns {PendingDrawFinalization | null}
 */
export function loadPendingDrawFinalization(
  storage,
  operatorUserId,
  environmentOrigin,
  now = new Date(),
) {
  const key = pendingDrawRecoveryStorageKey(operatorUserId, environmentOrigin);
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null");
    if (
      !parsed ||
      parsed.operatorUserId !== operatorUserId ||
      parsed.environmentOrigin !== environmentOrigin ||
      typeof parsed.competitionId !== "string" ||
      typeof parsed.drawId !== "string" ||
      !canonicalDigestPattern.test(parsed.seedReveal) ||
      !canonicalDigestPattern.test(parsed.seedCommitment) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      !Number.isFinite(Date.parse(parsed.expiresAt)) ||
      Date.parse(parsed.expiresAt) <= now.getTime()
    ) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {Storage} storage
 * @param {string} operatorUserId
 * @param {string} environmentOrigin
 * @param {PendingDrawFinalization | null} value
 */
export function savePendingDrawFinalization(
  storage,
  operatorUserId,
  environmentOrigin,
  value,
) {
  const key = pendingDrawRecoveryStorageKey(operatorUserId, environmentOrigin);
  if (value) storage.setItem(key, JSON.stringify(value));
  else storage.removeItem(key);
}

/**
 * @param {PendingDrawFinalization | null} recovery
 * @param {{id: string, seedCommitment: string, status: string} | null} draw
 * @param {string} operatorUserId
 * @param {string} environmentOrigin
 */
export function canRevealPendingDraw(
  recovery,
  draw,
  operatorUserId,
  environmentOrigin,
) {
  return Boolean(
    recovery &&
    draw?.status === "locked" &&
    recovery.drawId === draw.id &&
    recovery.seedCommitment === draw.seedCommitment &&
    recovery.operatorUserId === operatorUserId &&
    recovery.environmentOrigin === environmentOrigin,
  );
}

/** @param {Uint8Array} bytes */
function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
