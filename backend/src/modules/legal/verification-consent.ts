import type { VerificationConsentStatusResponseDto } from './dto/legal.dto';

export const devicePresenceConsentKey = 'device_presence_qr_camera' as const;
export const devicePresenceConsentVersion = '2026-07-05';

export type VerificationConsentEvent = {
  action: 'granted' | 'withdrawn';
  consent_version: string;
  created_at: Date;
};

export function buildVerificationConsentStatus(
  event: VerificationConsentEvent | undefined,
): VerificationConsentStatusResponseDto {
  const accepted =
    event?.action === 'granted' &&
    event.consent_version === devicePresenceConsentVersion;

  return {
    accepted,
    acceptedAt: accepted ? event.created_at.toISOString() : null,
    consentKey: devicePresenceConsentKey,
    consentVersion: devicePresenceConsentVersion,
    updatedAt: event?.created_at.toISOString() ?? null,
    withdrawnAt:
      event?.action === 'withdrawn' ? event.created_at.toISOString() : null,
  };
}
