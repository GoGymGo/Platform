import { privacyExportSchemaVersion } from './privacy-data-map';
import { minimizePrivacySessionEventPayload } from './privacy-export.builder';

describe('privacy export schema', () => {
  it('uses the portable v15 format', () => {
    expect(privacyExportSchemaVersion).toBe(16);
  });

  it('omits QR, device, attestation, trust, and hash evidence', () => {
    expect(
      minimizePrivacySessionEventPayload('gym_qr_scanned', {
        deviceAttestationHash: 'device-secret-hash',
        gymQrHash: 'qr-secret-hash',
        rawQrPayload: 'raw-secret',
      }),
    ).toEqual({});
    expect(
      minimizePrivacySessionEventPayload('heart_rate_sample', {
        deviceAttestationHash: 'device-secret-hash',
        heartRateBpm: 144,
        trustScore: 0.99,
      }),
    ).toEqual({ heartRateBpm: 144 });
  });

  it('does not reflect malformed or non-numeric health samples', () => {
    expect(
      minimizePrivacySessionEventPayload('heart_rate_sample', {
        heartRateBpm: '144',
      }),
    ).toEqual({});
    expect(
      minimizePrivacySessionEventPayload('heart_rate_sample', null),
    ).toEqual({});
  });
});
