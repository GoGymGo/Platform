import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LegalDocumentScreen } from '@/components/legal';
import { ScreenContainer, TerminalText } from '@/components/cyber';
import type { LegalDocument } from '@/constants/legal';
import { useCurrentLegalDocuments } from '@/data/accountReadinessHooks';
import type { AccountLegalDocument } from '@/domain/accountReadiness';

export function ConnectedLegalDocumentScreen({
  documentKey,
  fallback
}: {
  documentKey: string;
  fallback: LegalDocument;
}) {
  const params = useLocalSearchParams<{
    jurisdictionCode?: string;
    locale?: string;
  }>();
  const jurisdictionCode =
    typeof params.jurisdictionCode === 'string'
      ? params.jurisdictionCode
      : 'GLOBAL';
  const locale = typeof params.locale === 'string' ? params.locale : 'en';
  const documents = useCurrentLegalDocuments(jurisdictionCode, locale);
  const current = documents.data?.documents.find(
    (document) => document.documentKey === documentKey
  );

  if (documents.isLoading && !current) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <TerminalText glow live="polite" tone="cyan" variant="label">
            LOADING LEGAL DOCUMENT
          </TerminalText>
        </View>
      </ScreenContainer>
    );
  }

  return <LegalDocumentScreen document={current ? toLegalDocument(current) : fallback} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

function toLegalDocument(document: AccountLegalDocument): LegalDocument {
  return {
    effectiveDate: new Intl.DateTimeFormat('en-CA', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
      year: 'numeric'
    }).format(new Date(document.effectiveAt)).toUpperCase(),
    intro: document.content.intro,
    sections: document.content.sections,
    title: document.title
  };
}
