import {
  buildVerificationConsentStatus,
  devicePresenceConsentKey,
  devicePresenceConsentVersion,
} from './verification-consent';

describe('verification consent status', () => {
  it('reports no consent before the first event', () => {
    expect(buildVerificationConsentStatus(undefined)).toEqual({
      accepted: false,
      acceptedAt: null,
      consentKey: devicePresenceConsentKey,
      consentVersion: devicePresenceConsentVersion,
      updatedAt: null,
      withdrawnAt: null,
    });
  });

  it('accepts only the current granted consent version', () => {
    const createdAt = new Date('2026-07-19T12:00:00.000Z');

    expect(
      buildVerificationConsentStatus({
        action: 'granted',
        consent_version: devicePresenceConsentVersion,
        created_at: createdAt,
      }),
    ).toMatchObject({
      accepted: true,
      acceptedAt: createdAt.toISOString(),
      withdrawnAt: null,
    });
    expect(
      buildVerificationConsentStatus({
        action: 'granted',
        consent_version: 'obsolete-version',
        created_at: createdAt,
      }).accepted,
    ).toBe(false);
  });

  it('reports an explicit withdrawal timestamp', () => {
    const createdAt = new Date('2026-07-19T12:05:00.000Z');
    const status = buildVerificationConsentStatus({
      action: 'withdrawn',
      consent_version: devicePresenceConsentVersion,
      created_at: createdAt,
    });

    expect(status.accepted).toBe(false);
    expect(status.acceptedAt).toBeNull();
    expect(status.withdrawnAt).toBe(createdAt.toISOString());
  });
});
