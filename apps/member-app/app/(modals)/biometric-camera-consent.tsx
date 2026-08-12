import { Redirect } from 'expo-router';

import { LegalDocumentScreen } from '@/components/legal';
import { devicePresenceVerificationAvailable } from '@/config/workoutVerification';
import { biometricCameraConsent } from '@/constants/legal';

export default function BiometricCameraConsentScreen() {
  if (!devicePresenceVerificationAvailable) {
    return <Redirect href="/privacy-policy" />;
  }

  return <LegalDocumentScreen document={biometricCameraConsent} />;
}
