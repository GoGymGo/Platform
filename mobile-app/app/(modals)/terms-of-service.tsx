import { LegalDocumentScreen } from '@/components/legal';
import { termsOfService } from '@/constants/legal';

export default function TermsOfServiceModal() {
  return <LegalDocumentScreen document={termsOfService} />;
}
