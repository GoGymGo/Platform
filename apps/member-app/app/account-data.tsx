import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Linking, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { spacing } from '@/constants/theme';
import { useAppData } from '@/data/appDataHooks';
import type { PrivacyRequest } from '@/domain/accountSettings';
import { goBackOrReplace } from '@/navigation/goBack';

export default function AccountDataScreen() {
  const router = useRouter();
  const { accountSettings } = useAppData();
  const [busyAction, setBusyAction] = useState<'delete' | 'export' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryFn: () => accountSettings.listPrivacyRequests(),
    queryKey: ['privacy-requests']
  });
  const requests: readonly PrivacyRequest[] = requestsQuery.data ?? [];

  async function createRequest(requestType: 'delete' | 'export') {
    setBusyAction(requestType);
    setMessage(null);
    try {
      await accountSettings.createPrivacyRequest(requestType);
      setConfirmDelete(false);
      setMessage(
        requestType === 'export'
          ? 'Your data export was requested. Return here to check its status.'
          : 'Your account deletion request was submitted for secure processing.'
      );
      await requestsQuery.refetch();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadExport(requestId: string) {
    setMessage(null);
    try {
      const action = await accountSettings.getPrivacyDownload(requestId);
      await Linking.openURL(action.url);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="ACCOUNT DATA"
          onBack={() => goBackOrReplace(router, '/profile')}
          step="PRIVACY"
        />
        <BrandScreenHeader
          description="Request a portable copy of your GoGymGo account data or ask us to delete the account. Requests remain visible here until complete."
          eyebrow="YOUR DATA"
          title="PRIVACY REQUESTS"
        />

        <HUDBorderBox style={styles.actionCard} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            EXPORT MY DATA
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            We will prepare a private export. When it is ready, the download
            link is short-lived and available only to your signed-in account.
          </TerminalText>
          <CyberButtonOutline
            disabled={busyAction !== null}
            label={busyAction === 'export' ? 'REQUESTING...' : 'REQUEST DATA EXPORT'}
            onPress={() => void createRequest('export')}
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.actionCard} tone="red">
          <TerminalText tone="red" variant="label">
            DELETE MY ACCOUNT
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Deletion is irreversible after processing. Legal, fraud-prevention,
            and prize records may be retained only where the law requires it.
          </TerminalText>
          {confirmDelete ? (
            <View style={styles.confirmActions}>
              <CyberButtonOutline
                disabled={busyAction !== null}
                label="KEEP ACCOUNT"
                onPress={() => setConfirmDelete(false)}
                style={styles.confirmButton}
              />
              <CyberButtonOutline
                disabled={busyAction !== null}
                label={busyAction === 'delete' ? 'SUBMITTING...' : 'CONFIRM DELETE REQUEST'}
                onPress={() => void createRequest('delete')}
                style={styles.confirmButton}
                tone="red"
              />
            </View>
          ) : (
            <CyberButtonOutline
              disabled={busyAction !== null}
              label="REQUEST ACCOUNT DELETION"
              onPress={() => setConfirmDelete(true)}
              tone="red"
            />
          )}
        </HUDBorderBox>

        {message ? (
          <TerminalText live="polite" style={styles.message} tone="amber" uppercase={false} variant="caption">
            {message}
          </TerminalText>
        ) : null}

        <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
          REQUEST HISTORY
        </TerminalText>
        {requestsQuery.isPending ? (
          <TerminalText live="polite" tone="dim" variant="body">
            LOADING REQUESTS...
          </TerminalText>
        ) : requestsQuery.isError ? (
          <HUDBorderBox style={styles.emptyCard} tone="red">
            <TerminalText tone="red" uppercase={false} variant="body">
              Privacy request history could not load. Check your connection and try again.
            </TerminalText>
            <CyberButtonOutline
              label="TRY AGAIN"
              onPress={() => void requestsQuery.refetch()}
              tone="red"
            />
          </HUDBorderBox>
        ) : requests.length === 0 ? (
          <HUDBorderBox style={styles.emptyCard} tone="muted">
            <TerminalText tone="muted" uppercase={false} variant="body">
              You have no account-data requests.
            </TerminalText>
          </HUDBorderBox>
        ) : requests.map((request) => (
          <HUDBorderBox key={request.id} style={styles.requestCard} tone="muted">
            <View style={styles.requestHeader}>
              <TerminalText tone="text" variant="label">
                {request.requestType === 'export' ? 'DATA EXPORT' : 'ACCOUNT DELETION'}
              </TerminalText>
              <TerminalText
                glow={request.status === 'completed'}
                tone={request.status === 'completed' ? 'green' : 'amber'}
                variant="micro"
              >
                {request.status.replace('_', ' ')}
              </TerminalText>
            </View>
            <TerminalText tone="dim" uppercase={false} variant="caption">
              Requested {new Date(request.requestedAt).toLocaleString()}
            </TerminalText>
            {request.downloadAvailable ? (
              <CyberButtonOutline
                label="OPEN PRIVATE DOWNLOAD"
                onPress={() => void downloadExport(request.id)}
              />
            ) : null}
          </HUDBorderBox>
        ))}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'That privacy request could not be completed. Try again.';
}

const styles = StyleSheet.create({
  screen: brandScreenStyles.content,
  actionCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  confirmButton: {
    flex: 1
  },
  message: {
    marginVertical: spacing.md,
    textAlign: 'center'
  },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm
  },
  emptyCard: {
    padding: spacing.lg
  },
  requestCard: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  }
});
