import * as LocalAuthentication from 'expo-local-authentication';

export type PresenceVerificationResult =
  | { status: 'verified' }
  | { message: string; status: 'cancelled' | 'failed' | 'unavailable' };

export async function verifyLocalPresence(): Promise<PresenceVerificationResult> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync()
  ]);

  if (!hasHardware || !isEnrolled) {
    return {
      message:
        'Set up Face ID, Touch ID, fingerprint, or a device passcode before starting a Verified workout.',
      status: 'unavailable'
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use device passcode',
    promptMessage: 'Confirm your presence for GoGymGo',
    requireConfirmation: true
  });

  if (result.success) {
    return { status: 'verified' };
  }

  if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
    return {
      message: 'Presence check cancelled. Your workout has not advanced.',
      status: 'cancelled'
    };
  }

  return {
    message: 'Device authentication could not confirm your presence. Try again.',
    status: 'failed'
  };
}
