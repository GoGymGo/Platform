import { createHash } from 'node:crypto';

export const gymScanPolicy = {
  maximumAccuracyMeters: 50,
  minimumSessionMilliseconds: 30 * 60 * 1_000,
  sessionExpiryMilliseconds: 4 * 60 * 60 * 1_000,
} as const;

export function hashOpaqueValue(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function isAcceptableLocationAccuracy(accuracyMeters: number): boolean {
  return (
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > 0 &&
    accuracyMeters <= gymScanPolicy.maximumAccuracyMeters
  );
}

export function isWithinGymGeofence(
  distanceMeters: number,
  radiusMeters: number,
  accuracyMeters = 0,
): boolean {
  return (
    Number.isFinite(distanceMeters) &&
    Number.isFinite(radiusMeters) &&
    Number.isFinite(accuracyMeters) &&
    distanceMeters >= 0 &&
    radiusMeters >= 0 &&
    accuracyMeters >= 0 &&
    accuracyMeters <= gymScanPolicy.maximumAccuracyMeters &&
    distanceMeters <= radiusMeters + accuracyMeters
  );
}

export function isMatchingSessionCredential(
  sessionCredentialVersion: number | null,
  scannedCredentialVersion: number,
): boolean {
  return sessionCredentialVersion === scannedCredentialVersion;
}

export function resolveActiveSessionScan(input: {
  expiresAt: Date;
  now: Date;
  startedAt: Date;
}):
  | { outcome: 'rejected'; reason: 'session_expired' }
  | { outcome: 'too_early'; remainingSeconds: number }
  | { outcome: 'verified'; remainingSeconds: 0 } {
  if (input.now.getTime() >= input.expiresAt.getTime()) {
    return { outcome: 'rejected', reason: 'session_expired' };
  }

  const elapsedMilliseconds = input.now.getTime() - input.startedAt.getTime();
  if (elapsedMilliseconds < gymScanPolicy.minimumSessionMilliseconds) {
    return {
      outcome: 'too_early',
      remainingSeconds: Math.ceil(
        (gymScanPolicy.minimumSessionMilliseconds - elapsedMilliseconds) /
          1_000,
      ),
    };
  }

  return { outcome: 'verified', remainingSeconds: 0 };
}
