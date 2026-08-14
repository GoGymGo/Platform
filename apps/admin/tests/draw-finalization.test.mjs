import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDrawSeedCommitment,
  canRevealPendingDraw,
  canFinalizeCompetitionResults,
  createPendingDrawFinalization,
  createDrawSeed,
  loadPendingDrawFinalization,
  pendingDrawRecoveryStorageKey,
  savePendingDrawFinalization,
} from "../app/draw-finalization.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("waits for the 15-minute workout completion period", () => {
  const competition = {
    endsAt: "2026-08-12T13:25:00.000Z",
    status: "active",
  };

  assert.equal(
    canFinalizeCompetitionResults(
      competition,
      new Date("2026-08-12T13:39:59.999Z"),
    ),
    false,
  );
  assert.equal(
    canFinalizeCompetitionResults(
      competition,
      new Date("2026-08-12T13:40:00.000Z"),
    ),
    true,
  );
  assert.equal(
    canFinalizeCompetitionResults(
      { ...competition, status: "settled" },
      new Date("2026-08-12T13:40:00.000Z"),
    ),
    false,
  );
});

test("creates a 32-byte seed and hashes its bytes for the commitment", async () => {
  const seed = createDrawSeed();
  assert.match(seed, /^[a-f0-9]{64}$/);
  assert.equal(
    await buildDrawSeedCommitment(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ),
    "4884fdaafea47c29fea7159d0daddd9c085d6200e1359e85bb81736af6b7c837",
  );
  await assert.rejects(
    buildDrawSeedCommitment("A".repeat(64)),
    /32 bytes encoded as hexadecimal/,
  );
});

test("scopes bounded recovery to one operator and environment", () => {
  const storage = memoryStorage();
  const now = new Date("2026-08-14T12:00:00.000Z");
  const recovery = createPendingDrawFinalization({
    competitionId: "competition-1",
    environmentOrigin: "https://admin.gogymgo.ca",
    now,
    operatorUserId: "firebase-admin-1",
    seedCommitment: "b".repeat(64),
    seedReveal: "a".repeat(64),
  });
  savePendingDrawFinalization(
    storage,
    recovery.operatorUserId,
    recovery.environmentOrigin,
    recovery,
  );

  assert.deepEqual(
    loadPendingDrawFinalization(
      storage,
      "firebase-admin-1",
      "https://admin.gogymgo.ca",
      now,
    ),
    recovery,
  );
  assert.equal(
    loadPendingDrawFinalization(
      storage,
      "firebase-admin-2",
      "https://admin.gogymgo.ca",
      now,
    ),
    null,
  );
  assert.notEqual(
    pendingDrawRecoveryStorageKey(
      "firebase-admin-1",
      "https://admin.gogymgo.ca",
    ),
    pendingDrawRecoveryStorageKey(
      "firebase-admin-1",
      "https://staging-admin.gogymgo.ca",
    ),
  );
  assert.equal(
    loadPendingDrawFinalization(
      storage,
      "firebase-admin-1",
      "https://admin.gogymgo.ca",
      new Date("2026-09-14T12:00:00.000Z"),
    ),
    null,
  );
});

test("reveals only the exact locked server draw and commitment", () => {
  const recovery = createPendingDrawFinalization({
    competitionId: "competition-1",
    environmentOrigin: "https://admin.gogymgo.ca",
    operatorUserId: "firebase-admin-1",
    seedCommitment: "b".repeat(64),
    seedReveal: "a".repeat(64),
  });
  recovery.drawId = "draw-1";
  const draw = {
    id: "draw-1",
    seedCommitment: "b".repeat(64),
    status: "locked",
  };

  assert.equal(
    canRevealPendingDraw(
      recovery,
      draw,
      "firebase-admin-1",
      "https://admin.gogymgo.ca",
    ),
    true,
  );
  assert.equal(
    canRevealPendingDraw(
      recovery,
      { ...draw, seedCommitment: "c".repeat(64) },
      "firebase-admin-1",
      "https://admin.gogymgo.ca",
    ),
    false,
  );
  assert.equal(
    canRevealPendingDraw(
      recovery,
      draw,
      "firebase-admin-2",
      "https://admin.gogymgo.ca",
    ),
    false,
  );
});
