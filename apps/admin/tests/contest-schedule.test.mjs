import assert from "node:assert/strict";
import test from "node:test";
import {
  contestWorkoutCutoffs,
  formatContestDateTime,
  toZonedDateTimeInput,
  zonedDateTimeToIso,
} from "../app/contest-schedule.js";

const contestTimeZone = "America/Vancouver";

test("interprets dashboard schedule fields in the contest region", () => {
  assert.equal(
    zonedDateTimeToIso("2026-08-12T06:25", contestTimeZone),
    "2026-08-12T13:25:00.000Z",
  );
});

test("round-trips an instant through a region-local datetime input", () => {
  const instant = "2026-08-12T13:25:00.000Z";
  const input = toZonedDateTimeInput(instant, contestTimeZone);

  assert.equal(input, "2026-08-12T06:25");
  assert.equal(zonedDateTimeToIso(input, contestTimeZone), instant);
});

test("derives strict 15-minute workout start and completion cutoffs", () => {
  assert.deepEqual(contestWorkoutCutoffs("2026-08-12T13:25:00.000Z"), {
    completionDeadline: "2026-08-12T13:40:00.000Z",
    startBefore: "2026-08-12T13:10:00.000Z",
  });
});

test("shows the region timezone alongside exact dashboard times", () => {
  const formatted = formatContestDateTime(
    "2026-08-12T13:10:00.000Z",
    contestTimeZone,
  );

  assert.match(formatted, /Aug/);
  assert.match(formatted, /6:10/);
  assert.match(formatted, /PDT/);
});

test("rejects nonexistent daylight-saving wall-clock times", () => {
  assert.throws(
    () => zonedDateTimeToIso("2026-03-08T02:30", contestTimeZone),
    /does not exist/,
  );
});

test("rejects repeated daylight-saving wall-clock times", () => {
  assert.throws(
    () => zonedDateTimeToIso("2025-11-02T01:30", contestTimeZone),
    /occurs twice/,
  );
});
