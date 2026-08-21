import { createHash, timingSafeEqual } from 'node:crypto';
import type { Environment } from '../../config/environment';
import { stableJson } from '../../common/idempotency/stable-json';
import type { JsonObject } from '../../database/database.types';

export const landingPublicSourceSystem = 'landing-public-v1';

export type LandingIntakePolicy = {
  forwardingSecret: string;
  retentionDays: number;
};

export function readLandingIntakePolicy(
  environment: Pick<
    Environment,
    | 'LANDING_INTAKE_ENABLED'
    | 'LANDING_INTAKE_FORWARDING_SECRET'
    | 'LANDING_INTAKE_RETENTION_DAYS'
  >,
): LandingIntakePolicy | null {
  if (
    environment.LANDING_INTAKE_ENABLED !== true ||
    !environment.LANDING_INTAKE_FORWARDING_SECRET ||
    environment.LANDING_INTAKE_FORWARDING_SECRET.length < 32 ||
    !environment.LANDING_INTAKE_RETENTION_DAYS ||
    !Number.isSafeInteger(environment.LANDING_INTAKE_RETENTION_DAYS) ||
    environment.LANDING_INTAKE_RETENTION_DAYS < 30 ||
    environment.LANDING_INTAKE_RETENTION_DAYS > 730
  ) {
    return null;
  }
  return {
    forwardingSecret: environment.LANDING_INTAKE_FORWARDING_SECRET,
    retentionDays: environment.LANDING_INTAKE_RETENTION_DAYS,
  };
}

export function isAuthorizedLandingForwarder(
  provided: string | undefined,
  expected: string,
): boolean {
  const providedHash = createHash('sha256')
    .update(provided ?? '')
    .digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export function landingIntakeRetentionExpiry(
  now: Date,
  retentionDays: number,
): Date {
  return new Date(now.getTime() + retentionDays * 86_400_000);
}

export function landingIntakeSourceHash(value: JsonObject): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
