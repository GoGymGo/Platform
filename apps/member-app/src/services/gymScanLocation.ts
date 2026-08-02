import * as Location from 'expo-location';

import { assertLiveServicesAllowed } from '@/config/demoMode';

export type GymScanLocationResult =
  | {
      accuracyMeters: number;
      latitude: number;
      longitude: number;
      status: 'location-read';
    }
  | { status: 'permission-denied' }
  | { status: 'location-unavailable' };

export async function readGymScanLocation(): Promise<GymScanLocationResult> {
  assertLiveServicesAllowed('Device location');
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return { status: 'location-unavailable' };
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { status: 'permission-denied' };
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    if (
      location.coords.accuracy === null ||
      !Number.isFinite(location.coords.accuracy)
    ) {
      return { status: 'location-unavailable' };
    }
    return {
      accuracyMeters: Math.max(0.1, location.coords.accuracy),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      status: 'location-read'
    };
  } catch {
    return { status: 'location-unavailable' };
  }
}
