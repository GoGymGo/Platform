import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LegalDocumentScreen } from '@/components/legal';
import { HUDBorderBox, ScreenContainer, TerminalText } from '@/components/cyber';
import { FirstRunSecondaryButton } from '@/components/firstRun';
import { OnboardingHeader } from '@/components/onboarding';
import type { LegalDocument } from '@/constants/legal';
import { spacing } from '@/constants/theme';
import { useCurrentLegalDocuments } from '@/data/accountReadinessHooks';
import type { AccountLegalDocument } from '@/domain/accountReadiness';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAppTour } from '@/state/appTour';

export function ConnectedLegalDocumentScreen({
  documentKey,
  previewDocument
}: {
  documentKey: string;
  previewDocument?: LegalDocument;
}) {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const params = useLocalSearchParams<{
    jurisdictionCode?: string;
    locale?: string;
  }>();
  const jurisdictionCode =
    typeof params.jurisdictionCode === 'string' ? params.jurisdictionCode : 'GLOBAL';
  const locale = typeof params.locale === 'string' ? params.locale : 'en';
  const documents = useCurrentLegalDocuments(jurisdictionCode, locale);
  const current = documents.data?.documents.find(
    (document) => document.documentKey === documentKey
  );

  if (appTourActive && previewDocument) {
    return <LegalDocumentScreen document={toExplicitPreviewDocument(previewDocument)} />;
  }

  if (documents.isLoading || documents.isFetching) {
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

  if (documents.isError || !current) {
    return (
      <ScreenContainer>
        <View style={styles.unavailableNav}>
          <OnboardingHeader
            label="LEGAL DOCUMENT"
            onBack={() => goBackOrReplace(router, '/')}
            step="GOGYMGO"
          />
        </View>
        <View style={styles.unavailable}>
          <HUDBorderBox style={styles.unavailablePanel} tone="amber">
            <TerminalText tone="amber" variant="label">
              CURRENT DOCUMENT UNAVAILABLE
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {documents.isError
                ? 'The authoritative legal service could not be reached. No saved or bundled copy is being shown as current.'
                : 'No current published document is configured for this jurisdiction and locale.'}
            </TerminalText>
            <FirstRunSecondaryButton label="TRY AGAIN" onPress={() => void documents.refetch()} />
          </HUDBorderBox>
        </View>
      </ScreenContainer>
    );
  }

  return <LegalDocumentScreen document={toLegalDocument(current)} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  unavailableNav: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm
  },
  unavailable: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg
  },
  unavailablePanel: {
    gap: spacing.md,
    padding: spacing.lg
  }
});

function toExplicitPreviewDocument(document: LegalDocument): LegalDocument {
  if (document.effectiveDate === 'BROWSER PREVIEW') return document;
  return {
    ...document,
    effectiveDate: 'BROWSER PREVIEW',
    intro: `Preview only. This is not a current published legal document. ${document.intro}`,
    title: `${document.title} PREVIEW`
  };
}

function toLegalDocument(document: AccountLegalDocument): LegalDocument {
  return {
    effectiveDate: new Intl.DateTimeFormat('en-CA', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
      year: 'numeric'
    })
      .format(new Date(document.effectiveAt))
      .toUpperCase(),
    intro: document.content.intro,
    sections: document.content.sections,
    title: document.title
  };
}
