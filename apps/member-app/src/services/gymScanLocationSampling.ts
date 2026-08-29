import { normalizeGymScanAccuracyMeters } from '@/domain/gymScan';

export type GymScanLocationResult =
  | {
      accuracyMeters: number;
      latitude: number;
      longitude: number;
      status: 'location-read';
    }
  | { status: 'permission-denied' }
  | { status: 'mobile-required' }
  | { status: 'location-unavailable' };

export type GymScanWebReading = {
  accuracyMeters: number | null;
  latitude: number;
  longitude: number;
};

export type GymScanWebPositionOptions = {
  enableHighAccuracy: boolean;
  maximumAge: number;
  timeout: number;
};

export type GymScanWebGeolocation = {
  clearWatch: (watchId: number) => void;
  getCurrentPosition: (
    onReading: (reading: GymScanWebReading) => void,
    onError: (errorCode: number) => void,
    options: GymScanWebPositionOptions
  ) => void;
  watchPosition: (
    onReading: (reading: GymScanWebReading) => void,
    onError: (errorCode: number) => void,
    options: GymScanWebPositionOptions
  ) => number;
};

export const gymScanWebSamplingPolicy = {
  acceptableAccuracyMeters: 50,
  maximumWaitMs: 12_000,
  minimumWaitMs: 2_500
} as const;

type GymScanWebSamplingPolicy = {
  acceptableAccuracyMeters: number;
  maximumWaitMs: number;
  minimumWaitMs: number;
};

export function readFreshGymScanWebLocation(
  geolocation: GymScanWebGeolocation,
  policy: GymScanWebSamplingPolicy = gymScanWebSamplingPolicy
): Promise<GymScanLocationResult> {
  return new Promise((resolve) => {
    let bestReading: Extract<GymScanLocationResult, { status: 'location-read' }> | null = null;
    let minimumWaitElapsed = policy.minimumWaitMs <= 0;
    let settled = false;
    let watchId: number | null = null;

    const clearWatch = () => {
      if (watchId !== null) {
        geolocation.clearWatch(watchId);
        watchId = null;
      }
    };
    const settle = (result: GymScanLocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(minimumWaitTimer);
      clearTimeout(maximumWaitTimer);
      clearWatch();
      resolve(result);
    };
    const settleWithBestReading = () => {
      settle(bestReading ?? { status: 'location-unavailable' });
    };
    const maybeSettleAccurateReading = () => {
      if (
        minimumWaitElapsed &&
        bestReading &&
        bestReading.accuracyMeters <= policy.acceptableAccuracyMeters
      ) {
        settle(bestReading);
      }
    };
    const observeReading = (reading: GymScanWebReading) => {
      const candidate = normalizeGymScanWebReading(reading);
      if (candidate && (!bestReading || candidate.accuracyMeters < bestReading.accuracyMeters)) {
        bestReading = candidate;
      }
      maybeSettleAccurateReading();
    };
    const observeError = (errorCode: number) => {
      if (errorCode === 1) {
        settle({ status: 'permission-denied' });
        return;
      }
      if (bestReading) {
        settle(bestReading);
      }
    };

    const minimumWaitTimer = setTimeout(
      () => {
        minimumWaitElapsed = true;
        maybeSettleAccurateReading();
      },
      Math.max(0, policy.minimumWaitMs)
    );
    const maximumWaitTimer = setTimeout(
      settleWithBestReading,
      Math.max(policy.minimumWaitMs, policy.maximumWaitMs)
    );

    const positionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: policy.maximumWaitMs
    };

    // Android Chrome does not consistently surface its permission prompt when a
    // location flow begins with watchPosition. An explicit one-time read made
    // from the verification tap reliably triggers the browser permission request;
    // the watch still gathers a better reading when the first fix is coarse.
    geolocation.getCurrentPosition(observeReading, observeError, positionOptions);
    if (!settled) {
      watchId = geolocation.watchPosition(observeReading, observeError, positionOptions);
    }

    if (settled) {
      clearWatch();
    }
  });
}

function normalizeGymScanWebReading(
  reading: GymScanWebReading
): Extract<GymScanLocationResult, { status: 'location-read' }> | null {
  const accuracyMeters = normalizeGymScanAccuracyMeters(reading.accuracyMeters);
  if (
    accuracyMeters === null ||
    !Number.isFinite(reading.latitude) ||
    !Number.isFinite(reading.longitude) ||
    Math.abs(reading.latitude) > 90 ||
    Math.abs(reading.longitude) > 180
  ) {
    return null;
  }

  return {
    accuracyMeters,
    latitude: reading.latitude,
    longitude: reading.longitude,
    status: 'location-read'
  };
}
