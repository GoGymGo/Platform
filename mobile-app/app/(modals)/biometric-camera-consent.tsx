import { LegalDocumentScreen } from '@/components/legal';
import { biometricCameraConsent } from '@/constants/legal';

export default function BiometricCameraConsentModal() {
  return <LegalDocumentScreen document={biometricCameraConsent} />;
}
