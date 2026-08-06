import { LegalDocumentScreen } from '@/components/legal';
import { biometricCameraConsent } from '@/constants/legal';

export default function BiometricCameraConsentScreen() {
  return <LegalDocumentScreen document={biometricCameraConsent} />;
}
