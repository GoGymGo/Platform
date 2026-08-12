import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDrawSeedCommitment,
  canFinalizeCompetitionResults,
  createDrawSeed,
} from "../app/draw-finalization.js";

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
});
