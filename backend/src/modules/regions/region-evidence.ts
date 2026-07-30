import { BadRequestException } from '@nestjs/common';
import type { JsonObject } from '../../database/database.types';
import type { CreateRegionVerificationDto } from './dto/region.dto';

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function buildRegionEvidence(
  request: CreateRegionVerificationDto,
): JsonObject {
  if (request.latitude === undefined || request.longitude === undefined) {
    throw new BadRequestException({
      code: 'INVALID_LOCATION_EVIDENCE',
      message: 'Device-location verification requires latitude and longitude.',
    });
  }

  return {
    latitudeRounded: roundCoordinate(request.latitude),
    longitudeRounded: roundCoordinate(request.longitude),
    precision: 'three_decimal_places',
    source: 'client_device_location',
  };
}
