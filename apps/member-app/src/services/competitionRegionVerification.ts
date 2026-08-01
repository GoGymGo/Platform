import * as Location from 'expo-location';

export type RegionCoordinates = {
  latitude: number;
  longitude: number;
};

export type DeviceRegionVerificationResult =
  | {
      coordinates: RegionCoordinates;
      status: 'location-read';
    }
  | { status: 'permission-denied' }
  | { status: 'location-unavailable' };

export async function verifyCompetitionRegionWithDeviceLocation(): Promise<DeviceRegionVerificationResult> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return { status: 'location-unavailable' };
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return { status: 'permission-denied' };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    return {
      coordinates: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      },
      status: 'location-read'
    };
  } catch {
    return { status: 'location-unavailable' };
  }
}
