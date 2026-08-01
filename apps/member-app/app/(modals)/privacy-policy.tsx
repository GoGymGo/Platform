import { ConnectedLegalDocumentScreen } from '@/components/connectedLegalDocumentScreen';
import { privacyPolicy } from '@/constants/legal';

export default function PrivacyPolicyModal() {
  return (
    <ConnectedLegalDocumentScreen
      documentKey="privacy_policy"
      fallback={privacyPolicy}
    />
  );
}
