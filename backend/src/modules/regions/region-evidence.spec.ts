import { BadRequestException } from '@nestjs/common';
import type { CreateRegionVerificationDto } from './dto/region.dto';
import { buildRegionEvidence } from './region-evidence';

describe('region evidence minimization', () => {
  it('reduces coordinate precision before persistence', () => {
    expect(
      buildRegionEvidence({
        latitude: 48.428421,
        longitude: -123.365644,
        method: 'device_location',
        regionPolicyId: crypto.randomUUID(),
      }),
    ).toEqual({
      latitudeRounded: 48.428,
      longitudeRounded: -123.366,
      precision: 'three_decimal_places',
      source: 'client_device_location',
    });
  });

  it('rejects incomplete device-location evidence', () => {
    const incompleteRequest = {
      latitude: 48.4,
      method: 'device_location',
      regionPolicyId: crypto.randomUUID(),
    } as CreateRegionVerificationDto;

    expect(() => buildRegionEvidence(incompleteRequest)).toThrow(
      BadRequestException,
    );
  });
});
