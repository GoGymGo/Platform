import { createUserStorage } from '@/services/storage/userStorage';
import { isLocalPreviewEnabled } from '@/config/firebase';

const preferenceKeys = {
  biometricCameraConsent: 'gogymgo:legal:biometric-camera-consent',
  creatorInviteDismissed: 'gogymgo:onboarding:creator-invite-dismissed',
  creatorApplicationSubmitted: 'gogymgo:creator:application-submitted',
  preferredVerificationMethod: 'gogymgo:workout:preferred-verification-method',
  verificationPreference: 'gogymgo:workout:verification-preference'
} as const;

export const biometricCameraConsentVersion = '2026-07-05';

export type PreferredVerificationMethod = 'heartRate' | 'partnerGymQr';

export type VerificationPreference = {
  method: PreferredVerificationMethod;
  sourceKey: string;
  sourceLabel: string;
};

export function getPreferenceOwnerId(userId: string | null | undefined) {
  return userId ?? (isLocalPreviewEnabled ? 'local-preview' : null);
}

const defaultVerificationPreference: VerificationPreference = {
  method: 'heartRate',
  sourceKey: 'heartRateDevice',
  sourceLabel: 'HEART-RATE DEVICE'
};

export function isBiometricCameraConsentCurrent(value: string | null) {
  return value === biometricCameraConsentVersion;
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
      await storage.setItem(
        preferenceKeys.biometricCameraConsent,
        biometricCameraConsentVersion
      );
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
    await Promise.all([
      storage.setItem(preferenceKeys.verificationPreference, JSON.stringify(preference)),
      storage.setItem(preferenceKeys.preferredVerificationMethod, preference.method)
    ]);
  } catch {
    // Workout check-in still offers both methods when persistence is unavailable.
  }
}

export async function getVerificationPreference(
  userId: string
): Promise<VerificationPreference> {
  try {
    const storage = createUserStorage(userId);
    const [savedPreference, savedMethod] = await Promise.all([
      storage.getItem(preferenceKeys.verificationPreference),
      storage.getItem(preferenceKeys.preferredVerificationMethod)
    ]);
    const parsedPreference = parseVerificationPreference(savedPreference);

    if (parsedPreference) {
      return parsedPreference;
    }

    return savedMethod === 'partnerGymQr'
      ? {
          method: 'partnerGymQr',
          sourceKey: 'partnerGymQr',
          sourceLabel: 'PARTNER GYM QR'
        }
      : defaultVerificationPreference;
  } catch {
    return defaultVerificationPreference;
  }
}

export async function savePreferredVerificationMethod(
  userId: string,
  method: PreferredVerificationMethod
) {
  const currentPreference = await getVerificationPreference(userId);
  await saveVerificationPreference(
    userId,
    currentPreference.method === method
      ? currentPreference
      : method === 'partnerGymQr'
        ? {
            method,
            sourceKey: 'partnerGymQr',
            sourceLabel: 'PARTNER GYM QR'
          }
        : defaultVerificationPreference
  );
}

export async function getPreferredVerificationMethod(
  userId: string
): Promise<PreferredVerificationMethod> {
  return (await getVerificationPreference(userId)).method;
}

export async function recordCreatorApplication(userId: string) {
  try {
    await createUserStorage(userId).setItem(
      preferenceKeys.creatorApplicationSubmitted,
      'true'
    );
  } catch {
    // Backend creator status remains authoritative if local storage is unavailable.
  }
}

export async function hasSubmittedCreatorApplication(userId: string) {
  try {
    return (
      await createUserStorage(userId).getItem(preferenceKeys.creatorApplicationSubmitted)
    ) === 'true';
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
