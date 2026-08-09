import {
  gymScanPolicy,
  hashOpaqueValue,
  isAcceptableLocationAccuracy,
  isMatchingSessionCredential,
  isWithinGymGeofence,
  resolveActiveSessionScan,
} from './gym-scan-policy';

describe('static gym QR scan policy', () => {
  it('hashes credentials deterministically without storing the credential', () => {
    const credential = 'opaque-credential-value';
    expect(hashOpaqueValue(credential)).toHaveLength(64);
    expect(hashOpaqueValue(credential)).toBe(hashOpaqueValue(credential));
    expect(hashOpaqueValue(credential)).not.toContain(credential);
  });

  it('accepts the exact geofence boundary and rejects the first point outside', () => {
    expect(isWithinGymGeofence(75, 75)).toBe(true);
    expect(isWithinGymGeofence(75.001, 75)).toBe(false);
  });

  it('accepts an accurate reading whose uncertainty overlaps the gym boundary', () => {
    expect(isWithinGymGeofence(105, 75, 30)).toBe(true);
    expect(isWithinGymGeofence(105.001, 75, 30)).toBe(false);
    expect(isWithinGymGeofence(125, 75, 50)).toBe(true);
    expect(isWithinGymGeofence(125.001, 75, 50)).toBe(false);
  });

  it('caps coarse location uncertainty instead of rejecting a nearby centre point', () => {
    expect(isWithinGymGeofence(125, 75, 100_000)).toBe(true);
    expect(isWithinGymGeofence(125.001, 75, 100_000)).toBe(false);
  });

  it('rejects poor accuracy readings', () => {
    expect(
      isAcceptableLocationAccuracy(gymScanPolicy.maximumAccuracyMeters),
    ).toBe(true);
    expect(
      isAcceptableLocationAccuracy(gymScanPolicy.maximumAccuracyMeters + 0.001),
    ).toBe(false);
  });

  it('requires entry and exit to use the same credential version', () => {
    expect(isMatchingSessionCredential(3, 3)).toBe(true);
    expect(isMatchingSessionCredential(3, 4)).toBe(false);
    expect(isMatchingSessionCredential(null, 3)).toBe(false);
  });

  it('reports an early exit against server time', () => {
    const startedAt = new Date('2026-09-01T17:00:00.000Z');
    expect(
      resolveActiveSessionScan({
        expiresAt: new Date('2026-09-01T21:00:00.000Z'),
        now: new Date('2026-09-01T17:29:30.000Z'),
        startedAt,
      }),
    ).toEqual({ outcome: 'too_early', remainingSeconds: 30 });
  });

  it('verifies at exactly thirty minutes and expires at four hours', () => {
    const startedAt = new Date('2026-09-01T17:00:00.000Z');
    expect(
      resolveActiveSessionScan({
        expiresAt: new Date('2026-09-01T21:00:00.000Z'),
        now: new Date('2026-09-01T17:30:00.000Z'),
        startedAt,
      }),
    ).toEqual({ outcome: 'verified', remainingSeconds: 0 });
    expect(
      resolveActiveSessionScan({
        expiresAt: new Date('2026-09-01T21:00:00.000Z'),
        now: new Date('2026-09-01T21:00:00.000Z'),
        startedAt,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'session_expired' });
  });
});
