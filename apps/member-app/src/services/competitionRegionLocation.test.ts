import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  competitionRegionLocationPolicy,
  normalizeCompetitionRegionLocation,
} from "./competitionRegionLocation";

const now = Date.parse("2026-08-13T18:00:00.000Z");

describe("competition region location policy", () => {
  it("accepts and minimizes a fresh accurate sample", () => {
    assert.deepEqual(
      normalizeCompetitionRegionLocation(
        {
          accuracyMeters: 24.1234,
          latitude: 48.4284,
          longitude: -123.3656,
          observedAtMilliseconds: now - 1_000,
        },
        now,
      ),
      {
        accuracyMeters: 24.124,
        latitude: 48.4284,
        longitude: -123.3656,
        observedAt: "2026-08-13T17:59:59.000Z",
        status: "location-read",
      },
    );
  });

  it("rejects inaccurate, stale, and implausibly future samples", () => {
    assert.deepEqual(
      normalizeCompetitionRegionLocation(
        {
          accuracyMeters:
            competitionRegionLocationPolicy.maximumAccuracyMeters + 0.001,
          latitude: 48.4284,
          longitude: -123.3656,
          observedAtMilliseconds: now,
        },
        now,
      ),
      { status: "location-inaccurate" },
    );
    assert.deepEqual(
      normalizeCompetitionRegionLocation(
        {
          accuracyMeters: 10,
          latitude: 48.4284,
          longitude: -123.3656,
          observedAtMilliseconds:
            now - competitionRegionLocationPolicy.maximumAgeMilliseconds - 1,
        },
        now,
      ),
      { status: "location-stale" },
    );
    assert.deepEqual(
      normalizeCompetitionRegionLocation(
        {
          accuracyMeters: 10,
          latitude: 48.4284,
          longitude: -123.3656,
          observedAtMilliseconds:
            now +
            competitionRegionLocationPolicy.maximumFutureSkewMilliseconds +
            1,
        },
        now,
      ),
      { status: "location-stale" },
    );
  });

  it("rejects invalid coordinates, accuracy, and timestamps", () => {
    for (const reading of [
      {
        accuracyMeters: null,
        latitude: 48.4284,
        longitude: -123.3656,
        observedAtMilliseconds: now,
      },
      {
        accuracyMeters: 10,
        latitude: 91,
        longitude: -123.3656,
        observedAtMilliseconds: now,
      },
      {
        accuracyMeters: 10,
        latitude: 48.4284,
        longitude: Number.NaN,
        observedAtMilliseconds: now,
      },
    ]) {
      assert.deepEqual(normalizeCompetitionRegionLocation(reading, now), {
        status: "location-unavailable",
      });
    }
  });
});
