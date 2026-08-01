import type { JsonObject } from '../../database/database.types';

export function buildRegionEvidence(boundaryVersion: string): JsonObject {
  return {
    boundaryVersion,
    containment: 'inside',
    coordinatesRetained: false,
    source: 'client_device_location',
  };
}
