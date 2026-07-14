import { BadRequestException } from '@nestjs/common';
import type { JsonObject } from '../../database/database.types';
import type { CreateRegionVerificationDto } from './dto/region.dto';

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function buildRegionEvidence(
  request: CreateRegionVerificationDto,
  countryCode: string,
): JsonObject {
  if (request.method === 'device_location') {
    if (
      request.latitude === undefined ||
      request.longitude === undefined ||
      request.postalCode
    ) {
      throw new BadRequestException({
        code: 'INVALID_LOCATION_EVIDENCE',
        message:
          'Device-location verification requires only latitude and longitude.',
      });
    }

    return {
      latitudeRounded: roundCoordinate(request.latitude),
      longitudeRounded: roundCoordinate(request.longitude),
      precision: 'three_decimal_places',
      source: 'client_device_location',
    };
  }

  if (request.method === 'postal_code') {
    if (
      !request.postalCode ||
      request.latitude !== undefined ||
      request.longitude !== undefined
    ) {
      throw new BadRequestException({
        code: 'INVALID_POSTAL_EVIDENCE',
        message: 'Postal verification requires only a postal code.',
      });
    }

    const normalized = request.postalCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (
      countryCode === 'CA' &&
      /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(
        normalized,
      )
    ) {
      return {
        countryCode,
        postalPrefix: normalized.slice(0, 3),
        source: 'client_postal_code',
      };
    }
    if (countryCode === 'US' && /^\d{5}(?:\d{4})?$/.test(normalized)) {
      return {
        countryCode,
        postalPrefix: normalized.slice(0, 3),
        source: 'client_postal_code',
      };
    }

    throw new BadRequestException({
      code: 'POSTAL_CODE_REGION_MISMATCH',
      message:
        'The postal code format does not match the selected region country.',
    });
  }

  throw new BadRequestException({
    code: 'UNSUPPORTED_REGION_VERIFICATION_METHOD',
    message: 'This region verification method is not available to clients.',
  });
}
