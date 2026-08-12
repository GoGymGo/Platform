// @ts-check

const seedBytes = 32;

/**
 * The contest end is the workout-start cutoff anchor. Workouts already in
 * progress receive 15 minutes to finish before results can be finalized.
 *
 * @param {{endsAt: string, status: string}} competition
 * @param {Date} [now]
 */
export function canFinalizeCompetitionResults(
  competition,
  now = new Date(),
) {
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
  if (!/^[a-f0-9]{64}$/i.test(seedReveal)) {
    throw new Error("The draw seed must be 32 bytes encoded as hexadecimal.");
  }
  if (!cryptoProvider?.subtle) {
    throw new Error("Secure hashing is unavailable.");
  }
  const seed = Uint8Array.from(
    seedReveal.match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
  return bytesToHex(
    new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", seed)),
  );
}

/** @param {Uint8Array} bytes */
function bytesToHex(bytes) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
