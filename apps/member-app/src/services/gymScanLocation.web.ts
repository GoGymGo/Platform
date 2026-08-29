import { assertLiveServicesAllowed } from '@/config/demoMode';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import {
  readFreshGymScanWebLocation,
  type GymScanLocationResult
} from '@/services/gymScanLocationSampling';

export type { GymScanLocationResult } from '@/services/gymScanLocationSampling';

export async function readGymScanLocation(): Promise<GymScanLocationResult> {
  assertLiveServicesAllowed('Device location');
  if (!isMobileWebGymVerificationDevice()) {
    return { status: 'mobile-required' };
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { status: 'location-unavailable' };
  }

  try {
    return await readFreshGymScanWebLocation({
      clearWatch: (watchId) => navigator.geolocation.clearWatch(watchId),
      getCurrentPosition: (onReading, onError, options) =>
        navigator.geolocation.getCurrentPosition(
          (position) =>
            onReading({
              accuracyMeters: position.coords.accuracy,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }),
          (error) => onError(error.code),
          options
        ),
      watchPosition: (onReading, onError, options) =>
        navigator.geolocation.watchPosition(
          (position) =>
            onReading({
              accuracyMeters: position.coords.accuracy,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }),
          (error) => onError(error.code),
          options
        )
    });
  } catch {
    return { status: 'location-unavailable' };
  }
}
