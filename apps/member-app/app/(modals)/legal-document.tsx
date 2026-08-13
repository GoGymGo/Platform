import { useLocalSearchParams } from 'expo-router';

import { ConnectedLegalDocumentScreen } from '@/components/connectedLegalDocumentScreen';

export default function LegalDocumentModal() {
  const { documentKey } = useLocalSearchParams<{ documentKey?: string }>();

  return (
    <ConnectedLegalDocumentScreen
      documentKey={typeof documentKey === 'string' ? documentKey : ''}
    />
  );
}
