import { ConnectedLegalDocumentScreen } from '@/components/connectedLegalDocumentScreen';
import { termsOfService } from '@/constants/legal';

export default function TermsOfServiceModal() {
  return (
    <ConnectedLegalDocumentScreen
      documentKey="terms_of_service"
      fallback={termsOfService}
    />
  );
}
