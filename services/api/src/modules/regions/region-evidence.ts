import type { JsonObject } from '../../database/database.types';

export function buildRegionEvidence(boundaryVersion: string): JsonObject {
  return {
    accuracyAcceptedAtOrBelowMeters: 50,
    boundaryVersion,
    containment: 'inside',
    coordinatesRetained: false,
    freshnessAcceptedWithinSeconds: 30,
    source: 'client_device_location',
  };
}
