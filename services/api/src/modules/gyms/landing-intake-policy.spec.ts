import {
  isAuthorizedLandingForwarder,
  landingIntakeRetentionExpiry,
  landingIntakeSourceHash,
  readLandingIntakePolicy,
} from './landing-intake-policy';

const secret = 's'.repeat(32);

describe('landing intake policy', () => {
  it('stays disabled unless the exact gate, secret, and retention are configured', () => {
    expect(
      readLandingIntakePolicy({
        LANDING_INTAKE_ENABLED: false,
        LANDING_INTAKE_FORWARDING_SECRET: secret,
        LANDING_INTAKE_RETENTION_DAYS: 90,
      }),
    ).toBeNull();
    expect(
      readLandingIntakePolicy({
        LANDING_INTAKE_ENABLED: true,
        LANDING_INTAKE_FORWARDING_SECRET: undefined,
        LANDING_INTAKE_RETENTION_DAYS: 90,
      }),
    ).toBeNull();
    expect(
      readLandingIntakePolicy({
        LANDING_INTAKE_ENABLED: true,
        LANDING_INTAKE_FORWARDING_SECRET: secret,
        LANDING_INTAKE_RETENTION_DAYS: 90,
      }),
    ).toEqual({ forwardingSecret: secret, retentionDays: 90 });
  });

  it('authorizes only the exact forwarding secret and creates stable minimized hashes', () => {
    expect(isAuthorizedLandingForwarder(secret, secret)).toBe(true);
    expect(isAuthorizedLandingForwarder(`${secret}x`, secret)).toBe(false);
    expect(isAuthorizedLandingForwarder(undefined, secret)).toBe(false);
    expect(landingIntakeSourceHash({ a: 1, b: 'two' })).toBe(
      landingIntakeSourceHash({ b: 'two', a: 1 }),
    );
    expect(
      landingIntakeRetentionExpiry(
        new Date('2026-08-21T12:00:00.000Z'),
        90,
      ).toISOString(),
    ).toBe('2026-11-19T12:00:00.000Z');
  });
});
