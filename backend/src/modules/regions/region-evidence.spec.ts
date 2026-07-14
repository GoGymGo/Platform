import { BadRequestException } from '@nestjs/common';
import { buildRegionEvidence } from './region-evidence';

describe('region evidence minimization', () => {
  it('stores only a Canadian postal prefix', () => {
    expect(
      buildRegionEvidence(
        {
          method: 'postal_code',
          postalCode: 'V8W 1P6',
          regionPolicyId: crypto.randomUUID(),
        },
        'CA',
      ),
    ).toEqual({
      countryCode: 'CA',
      postalPrefix: 'V8W',
      source: 'client_postal_code',
    });
  });

  it('reduces coordinate precision before persistence', () => {
    expect(
      buildRegionEvidence(
        {
          latitude: 48.428421,
          longitude: -123.365644,
          method: 'device_location',
          regionPolicyId: crypto.randomUUID(),
        },
        'CA',
      ),
    ).toEqual({
      latitudeRounded: 48.428,
      longitudeRounded: -123.366,
      precision: 'three_decimal_places',
      source: 'client_device_location',
    });
  });

  it('rejects mixed evidence sources', () => {
    expect(() =>
      buildRegionEvidence(
        {
          latitude: 48.4,
          longitude: -123.3,
          method: 'device_location',
          postalCode: 'V8W 1P6',
          regionPolicyId: crypto.randomUUID(),
        },
        'CA',
      ),
    ).toThrow(BadRequestException);
  });
});
