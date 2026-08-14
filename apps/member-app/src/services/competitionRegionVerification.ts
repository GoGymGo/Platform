import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { assertLiveServicesAllowed } from '@/config/demoMode';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import {
  competitionRegionLocationPolicy,
  normalizeCompetitionRegionLocation
} from '@/services/competitionRegionLocation';

export type RegionCoordinates = {
  accuracyMeters: number;
  latitude: number;
  longitude: number;
  observedAt: string;
};

export type DeviceRegionVerificationResult =
  | {
      coordinates: RegionCoordinates;
      status: 'location-read';
    }
  | { status: 'permission-denied' }
  | { status: 'mobile-required' }
  | { status: 'location-inaccurate' }
  | { status: 'location-stale' }
  | { status: 'location-timeout' }
  | { status: 'location-unavailable' };

export async function verifyCompetitionRegionWithDeviceLocation(): Promise<DeviceRegionVerificationResult> {
  assertLiveServicesAllowed('Device location');
  if (Platform.OS === 'web' && !isMobileWebGymVerificationDevice()) {
    return { status: 'mobile-required' };
  }
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return { status: 'location-unavailable' };
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return { status: 'permission-denied' };
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const locationResult = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      }).then((location) => ({ location, status: 'read' as const })),
      new Promise<{ status: 'timeout' }>((resolve) => {
        timeout = setTimeout(
          () => resolve({ status: 'timeout' }),
          competitionRegionLocationPolicy.timeoutMilliseconds
        );
      })
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });

    if (locationResult.status === 'timeout') {
      return { status: 'location-timeout' };
    }

    const location = normalizeCompetitionRegionLocation({
      accuracyMeters: locationResult.location.coords.accuracy,
      latitude: locationResult.location.coords.latitude,
      longitude: locationResult.location.coords.longitude,
      observedAtMilliseconds: locationResult.location.timestamp
    });

    if (location.status !== 'location-read') {
      return location;
    }

    return {
      coordinates: {
        accuracyMeters: location.accuracyMeters,
        latitude: location.latitude,
        longitude: location.longitude,
        observedAt: location.observedAt
      },
      status: 'location-read'
    };
  } catch {
    return { status: 'location-unavailable' };
  }
}
