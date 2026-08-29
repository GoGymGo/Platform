import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  readFreshGymScanWebLocation,
  type GymScanWebGeolocation,
  type GymScanWebPositionOptions,
  type GymScanWebReading
} from './gymScanLocationSampling';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';

it('allows the browser pilot to verify location on desktop, phone, and tablet', () => {
  assert.equal(
    isMobileWebGymVerificationDevice({
      maxTouchPoints: 0,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'
    }),
    true
  );
  assert.equal(
    isMobileWebGymVerificationDevice({
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile'
    }),
    true
  );
  assert.equal(
    isMobileWebGymVerificationDevice({
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/19 Safari'
    }),
    true
  );
});

type ScheduledEvent =
  { afterMs: number; reading: GymScanWebReading } | { afterMs: number; errorCode: number };

function fakeGeolocation(events: readonly ScheduledEvent[]) {
  let clearedWatchId: number | null = null;
  let observedCurrentOptions: GymScanWebPositionOptions | null = null;
  let observedWatchOptions: GymScanWebPositionOptions | null = null;
  const calls: string[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const schedule = (
    scheduledEvents: readonly ScheduledEvent[],
    onReading: (reading: GymScanWebReading) => void,
    onError: (errorCode: number) => void
  ) => {
    for (const event of scheduledEvents) {
      timers.push(
        setTimeout(() => {
          if ('reading' in event) onReading(event.reading);
          else onError(event.errorCode);
        }, event.afterMs)
      );
    }
  };
  const geolocation: GymScanWebGeolocation = {
    clearWatch: (watchId) => {
      clearedWatchId = watchId;
      timers.forEach(clearTimeout);
    },
    getCurrentPosition: (onReading, onError, options) => {
      calls.push('getCurrentPosition');
      observedCurrentOptions = options;
      schedule(events.slice(0, 1), onReading, onError);
    },
    watchPosition: (onReading, onError, options) => {
      calls.push('watchPosition');
      observedWatchOptions = options;
      schedule(events, onReading, onError);
      return 42;
    }
  };

  return {
    geolocation,
    getCalls: () => calls,
    getClearedWatchId: () => clearedWatchId,
    getObservedCurrentOptions: () => observedCurrentOptions,
    getObservedWatchOptions: () => observedWatchOptions
  };
}

const fastPolicy = {
  acceptableAccuracyMeters: 50,
  maximumWaitMs: 40,
  minimumWaitMs: 8
};

describe('fresh browser gym location sampling', () => {
  it('requests one current position before watching for the best high-accuracy sample', async () => {
    const fake = fakeGeolocation([
      {
        afterMs: 1,
        reading: { accuracyMeters: 120, latitude: 48.4, longitude: -123.5 }
      },
      {
        afterMs: 4,
        reading: { accuracyMeters: 24.1234, latitude: 48.5, longitude: -123.6 }
      }
    ]);

    const result = await readFreshGymScanWebLocation(fake.geolocation, fastPolicy);

    assert.deepEqual(result, {
      accuracyMeters: 24.124,
      latitude: 48.5,
      longitude: -123.6,
      status: 'location-read'
    });
    assert.deepEqual(fake.getCalls(), ['getCurrentPosition', 'watchPosition']);
    assert.deepEqual(fake.getObservedCurrentOptions(), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 40
    });
    assert.deepEqual(fake.getObservedWatchOptions(), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 40
    });
    assert.equal(fake.getClearedWatchId(), 42);
  });

  it('uses the best available coarse reading after the sampling window', async () => {
    const fake = fakeGeolocation([
      {
        afterMs: 1,
        reading: { accuracyMeters: 95, latitude: 48.4, longitude: -123.5 }
      },
      {
        afterMs: 5,
        reading: { accuracyMeters: 68, latitude: 48.5, longitude: -123.6 }
      }
    ]);

    const result = await readFreshGymScanWebLocation(fake.geolocation, fastPolicy);

    assert.deepEqual(result, {
      accuracyMeters: 68,
      latitude: 48.5,
      longitude: -123.6,
      status: 'location-read'
    });
  });

  it('surfaces denied permission and ignores invalid readings', async () => {
    const denied = fakeGeolocation([{ afterMs: 1, errorCode: 1 }]);
    assert.deepEqual(await readFreshGymScanWebLocation(denied.geolocation, fastPolicy), {
      status: 'permission-denied'
    });

    const unavailable = fakeGeolocation([
      {
        afterMs: 1,
        reading: {
          accuracyMeters: Number.NaN,
          latitude: 48.4,
          longitude: -123.5
        }
      },
      {
        afterMs: 2,
        reading: { accuracyMeters: 20, latitude: 100, longitude: -123.5 }
      }
    ]);
    assert.deepEqual(await readFreshGymScanWebLocation(unavailable.geolocation, fastPolicy), {
      status: 'location-unavailable'
    });
  });
});
