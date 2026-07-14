import * as Location from 'expo-location';

import { resolveCompetitionRegionFromCoordinates } from '@/domain/competitionRegionVerification';
import type { CompetitionRegion } from '@/config/regions';

export type DeviceRegionVerificationResult =
  | {
      coordinates: { latitude: number; longitude: number };
      status: 'candidate-found';
      region: CompetitionRegion;
    }
  | { status: 'permission-denied' }
  | { status: 'location-unavailable' }
  | { status: 'unsupported-region' };

export async function verifyCompetitionRegionWithDeviceLocation(): Promise<DeviceRegionVerificationResult> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return { status: 'location-unavailable' };
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    return { status: 'permission-denied' };
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    const region = resolveCompetitionRegionFromCoordinates(location.coords);

    return region
      ? {
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          },
          status: 'candidate-found',
          region
        }
      : { status: 'unsupported-region' };
  } catch {
    return { status: 'location-unavailable' };
  }
}
