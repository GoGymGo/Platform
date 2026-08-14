export const competitionRegionLocationPolicy = {
  maximumAccuracyMeters: 50,
  maximumAgeMilliseconds: 30_000,
  maximumFutureSkewMilliseconds: 5_000,
  timeoutMilliseconds: 15_000,
} as const;

export type CompetitionRegionLocationResult =
  | {
      accuracyMeters: number;
      latitude: number;
      longitude: number;
      observedAt: string;
      status: "location-read";
    }
  | { status: "location-inaccurate" }
  | { status: "location-stale" }
  | { status: "location-unavailable" };

export function normalizeCompetitionRegionLocation(
  reading: {
    accuracyMeters: number | null;
    latitude: number;
    longitude: number;
    observedAtMilliseconds: number;
  },
  nowMilliseconds = Date.now(),
): CompetitionRegionLocationResult {
  if (
    reading.accuracyMeters === null ||
    !Number.isFinite(reading.accuracyMeters) ||
    reading.accuracyMeters < 0 ||
    !Number.isFinite(reading.latitude) ||
    Math.abs(reading.latitude) > 90 ||
    !Number.isFinite(reading.longitude) ||
    Math.abs(reading.longitude) > 180 ||
    !Number.isFinite(reading.observedAtMilliseconds)
  ) {
    return { status: "location-unavailable" };
  }

  if (
    reading.observedAtMilliseconds >
      nowMilliseconds +
        competitionRegionLocationPolicy.maximumFutureSkewMilliseconds ||
    nowMilliseconds - reading.observedAtMilliseconds >
      competitionRegionLocationPolicy.maximumAgeMilliseconds
  ) {
    return { status: "location-stale" };
  }

  if (
    reading.accuracyMeters >
    competitionRegionLocationPolicy.maximumAccuracyMeters
  ) {
    return { status: "location-inaccurate" };
  }

  return {
    accuracyMeters: Math.ceil(reading.accuracyMeters * 1_000) / 1_000,
    latitude: reading.latitude,
    longitude: reading.longitude,
    observedAt: new Date(reading.observedAtMilliseconds).toISOString(),
    status: "location-read",
  };
}
