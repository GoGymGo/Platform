import { LegalDocumentScreen } from '@/components/legal';
import { privacyPolicy } from '@/constants/legal';

export default function PrivacyPolicyModal() {
  return <LegalDocumentScreen document={privacyPolicy} />;
}
