import { createUserStorage } from '@/services/storage/userStorage';
import { creatorFeaturesEnabled } from '@/config/features';
import { verifiedPartnerGymCatalogAvailable } from '@/config/partnerGyms';
import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
import { devicePresenceConsentVersion } from '@/domain/accountSettings';

export { devicePresenceConsentVersion as biometricCameraConsentVersion } from '@/domain/accountSettings';

const preferenceKeys = {
  biometricCameraConsent: 'gogymgo:legal:biometric-camera-consent',
  creatorInviteDismissed: 'gogymgo:onboarding:creator-invite-dismissed',
  creatorApplicationSubmitted: 'gogymgo:creator:application-submitted',
  preferredVerificationMethod: 'gogymgo:workout:preferred-verification-method',
  verificationPreference: 'gogymgo:workout:verification-preference'
} as const;

export type PreferredVerificationMethod = 'heartRate' | 'partnerGymQr';

export type ClarityTipKey =
  | 'competition-overview'
  | 'weekly-challenge';

export type VerificationPreference = {
  method: PreferredVerificationMethod;
  sourceKey: string;
  sourceLabel: string;
};

export function getPreferenceOwnerId(userId: string | null | undefined) {
  return userId ?? null;
}

const defaultVerificationPreference: VerificationPreference = {
  method: 'partnerGymQr',
  sourceKey: 'partnerGymQr',
  sourceLabel: 'PARTNER GYM LOCATION'
};

const heartRateVerificationPreference: VerificationPreference = {
  method: 'heartRate',
  sourceKey: 'heartRateDevice',
  sourceLabel: 'HEART-RATE DEVICE'
};

function getSupportedVerificationPreference(
  preference: VerificationPreference
): VerificationPreference {
  if (preference.method === 'heartRate' && !heartRateTelemetryAvailable) {
    return defaultVerificationPreference;
  }
  if (preference.method === 'partnerGymQr' && !verifiedPartnerGymCatalogAvailable) {
    return heartRateTelemetryAvailable
      ? heartRateVerificationPreference
      : defaultVerificationPreference;
  }
  if (preference.method === 'partnerGymQr') {
    return defaultVerificationPreference;
  }
  return preference;
}

export function isBiometricCameraConsentCurrent(value: string | null) {
  return value === devicePresenceConsentVersion;
}

export async function getBiometricCameraConsent(userId: string) {
  try {
    const storage = createUserStorage(userId);
    return isBiometricCameraConsentCurrent(
      await storage.getItem(preferenceKeys.biometricCameraConsent)
    );
  } catch {
    return false;
  }
}

export async function setBiometricCameraConsent(userId: string, accepted: boolean) {
  try {
    const storage = createUserStorage(userId);
    if (accepted) {
      await storage.setItem(preferenceKeys.biometricCameraConsent, devicePresenceConsentVersion);
      return;
    }

    await storage.removeItem(preferenceKeys.biometricCameraConsent);
  } catch {
    // A failed write keeps verification gated until consent can be recorded.
  }
}

export function parseVerificationPreference(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<VerificationPreference>;
    if (
      (parsed.method === 'heartRate' || parsed.method === 'partnerGymQr') &&
      typeof parsed.sourceKey === 'string' &&
      parsed.sourceKey.length > 0 &&
      typeof parsed.sourceLabel === 'string' &&
      parsed.sourceLabel.length > 0
    ) {
      return parsed as VerificationPreference;
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveVerificationPreference(
  userId: string,
  preference: VerificationPreference
) {
  try {
    const storage = createUserStorage(userId);
    const supportedPreference = getSupportedVerificationPreference(preference);
    await Promise.all([
      storage.setItem(preferenceKeys.verificationPreference, JSON.stringify(supportedPreference)),
      storage.setItem(preferenceKeys.preferredVerificationMethod, supportedPreference.method)
    ]);
  } catch {
    // Active workout verification remains available when persistence is unavailable.
  }
}

export async function getVerificationPreference(userId: string): Promise<VerificationPreference> {
  try {
    const storage = createUserStorage(userId);
    const [savedPreference, savedMethod] = await Promise.all([
      storage.getItem(preferenceKeys.verificationPreference),
      storage.getItem(preferenceKeys.preferredVerificationMethod)
    ]);
    const parsedPreference = parseVerificationPreference(savedPreference);

    if (parsedPreference) {
      const supportedPreference = getSupportedVerificationPreference(parsedPreference);
      if (supportedPreference !== parsedPreference) {
        await Promise.all([
          storage.setItem(
            preferenceKeys.verificationPreference,
            JSON.stringify(supportedPreference)
          ),
          storage.setItem(preferenceKeys.preferredVerificationMethod, supportedPreference.method)
        ]);
      }
      return supportedPreference;
    }

    if (savedMethod === 'partnerGymQr') {
      if (verifiedPartnerGymCatalogAvailable) {
        return {
          method: 'partnerGymQr',
          sourceKey: 'partnerGymQr',
          sourceLabel: 'PARTNER GYM LOCATION'
        };
      }

      await Promise.all([
        storage.setItem(
          preferenceKeys.verificationPreference,
          JSON.stringify(defaultVerificationPreference)
        ),
        storage.setItem(
          preferenceKeys.preferredVerificationMethod,
          defaultVerificationPreference.method
        )
      ]);
    }

    if (savedMethod === 'heartRate' && heartRateTelemetryAvailable) {
      return heartRateVerificationPreference;
    }

    return defaultVerificationPreference;
  } catch {
    return defaultVerificationPreference;
  }
}

export async function hasSavedVerificationPreference(userId: string) {
  try {
    const savedPreference = await createUserStorage(userId).getItem(
      preferenceKeys.verificationPreference
    );
    return parseVerificationPreference(savedPreference) !== null;
  } catch {
    return false;
  }
}

export async function savePreferredVerificationMethod(
  userId: string,
  method: PreferredVerificationMethod
) {
  const supportedMethod = getSupportedVerificationPreference(
    method === 'partnerGymQr'
      ? defaultVerificationPreference
      : heartRateVerificationPreference
  ).method;
  const currentPreference = await getVerificationPreference(userId);
  await saveVerificationPreference(
    userId,
    currentPreference.method === supportedMethod
      ? currentPreference
      : supportedMethod === 'partnerGymQr'
        ? {
            method: supportedMethod,
            sourceKey: 'partnerGymQr',
            sourceLabel: 'PARTNER GYM LOCATION'
          }
        : heartRateVerificationPreference
  );
}

export async function getPreferredVerificationMethod(
  userId: string
): Promise<PreferredVerificationMethod> {
  return (await getVerificationPreference(userId)).method;
}

export async function recordCreatorApplication(userId: string) {
  try {
    await createUserStorage(userId).setItem(preferenceKeys.creatorApplicationSubmitted, 'true');
  } catch {
    // Backend creator status remains authoritative if local storage is unavailable.
  }
}

export async function hasSubmittedCreatorApplication(userId: string) {
  try {
    return (
      (await createUserStorage(userId).getItem(preferenceKeys.creatorApplicationSubmitted)) ===
      'true'
    );
  } catch {
    return false;
  }
}

export async function dismissCreatorInvite(userId: string) {
  try {
    await createUserStorage(userId).setItem(preferenceKeys.creatorInviteDismissed, 'true');
  } catch {
    // This preference must never block onboarding if local storage is unavailable.
  }
}

export async function shouldShowCreatorInvite(userId: string) {
  if (!creatorFeaturesEnabled) {
    return false;
  }

  try {
    const storage = createUserStorage(userId);
    const [dismissed, applicationSubmitted] = await Promise.all([
      storage.getItem(preferenceKeys.creatorInviteDismissed),
      storage.getItem(preferenceKeys.creatorApplicationSubmitted)
    ]);

    return dismissed !== 'true' && applicationSubmitted !== 'true';
  } catch {
    return true;
  }
}

export async function isClarityTipDismissed(
  userId: string,
  tip: ClarityTipKey
) {
  try {
    return (
      await createUserStorage(userId).getItem(getClarityTipStorageKey(tip))
    ) === 'true';
  } catch {
    return false;
  }
}

export async function dismissClarityTip(
  userId: string,
  tip: ClarityTipKey
) {
  try {
    await createUserStorage(userId).setItem(
      getClarityTipStorageKey(tip),
      'true'
    );
  } catch {
    // Contextual guidance remains visible if its local preference cannot be saved.
  }
}

export function getClarityTipStorageKey(tip: ClarityTipKey) {
  return `gogymgo:clarity:${tip}:dismissed`;
}
