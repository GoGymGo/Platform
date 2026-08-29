import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLegacyDrawRecovery,
  isAutomaticResultsPublicationDue,
} from "../app/automatic-results-publication.js";

test("queues automatic publication after the 15-minute workout completion period", () => {
  const competition = {
    endsAt: "2026-08-12T13:25:00.000Z",
    status: "active",
  };

  assert.equal(
    isAutomaticResultsPublicationDue(
      competition,
      new Date("2026-08-12T13:39:59.999Z"),
    ),
    false,
  );
  assert.equal(
    isAutomaticResultsPublicationDue(
      competition,
      new Date("2026-08-12T13:40:00.000Z"),
    ),
    true,
  );
  assert.equal(
    isAutomaticResultsPublicationDue(
      { ...competition, status: "settled" },
      new Date("2026-08-12T13:40:00.000Z"),
    ),
    false,
  );
});

test("removes only the retired operator-and-origin-scoped draw recovery record", () => {
  const removed = [];
  const storage = {
    removeItem: (key) => removed.push(key),
  };

  clearLegacyDrawRecovery(
    storage,
    "firebase-admin-1",
    "https://admin.gogymgo.ca",
  );

  assert.deepEqual(removed, [
    "gogymgo.admin.pending-draw-finalization.v2:https%3A%2F%2Fadmin.gogymgo.ca:firebase-admin-1",
  ]);
});
