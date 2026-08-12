import * as Location from 'expo-location';

import { assertLiveServicesAllowed } from '@/config/demoMode';
import { normalizeGymScanAccuracyMeters } from '@/domain/gymScan';
import type { GymScanLocationResult } from '@/services/gymScanLocationSampling';

export type { GymScanLocationResult } from '@/services/gymScanLocationSampling';

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
    const accuracyMeters = normalizeGymScanAccuracyMeters(
      location.coords.accuracy
    );
    if (accuracyMeters === null) {
      return { status: 'location-unavailable' };
    }
    return {
      accuracyMeters,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      status: 'location-read'
    };
  } catch {
    return { status: 'location-unavailable' };
  }
}
