import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { CyberButtonOutline, CyberButtonPrimary, HUDBorderBox, TerminalText } from '@/components/cyber';
import { spacing } from '@/constants/theme';
import { isGymScanCompletionReady } from '@/domain/gymScan';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import {
  cancelGymScanCompletionReminder,
  scheduleGymScanCompletionReminder
} from '@/services/gymScanCompletionReminder';
import { usePendingGymScanSession } from '@/hooks/usePendingGymScanSession';
import { useAuth } from '@/state/auth';

export function GymScanCompletionPrompt() {
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (!mobileGymVerificationAvailable) {
    return null;
  }

  return <MobileGymScanCompletionPrompt />;
}

function MobileGymScanCompletionPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { activeSession } = usePendingGymScanSession();
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => appStateSubscription.remove();
  }, []);

  useEffect(() => {
    if (!activeSession) {
      void cancelGymScanCompletionReminder();
      return;
    }

    void scheduleGymScanCompletionReminder({
      gymName: activeSession.gymName,
      minimumCompleteAt: activeSession.minimumCompleteAt,
      sessionId: activeSession.sessionId
    });
    const target = Date.parse(activeSession.minimumCompleteAt);
    const delay = target - Date.now();
    if (!Number.isFinite(target) || delay <= 0) {
      const immediate = setTimeout(() => setNow(Date.now()), 0);
      return () => clearTimeout(immediate);
    }

    const timeout = setTimeout(() => setNow(Date.now()), delay + 50);
    return () => clearTimeout(timeout);
  }, [activeSession]);

  const ready =
    now !== null &&
    isGymScanCompletionReady(activeSession?.minimumCompleteAt, now);

  useEffect(() => {
    if (!ready || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const previousTitle = document.title;
    document.title = 'Time to finish your workout | GoGymGo';
    return () => {
      document.title = previousTitle;
    };
  }, [ready]);

  if (
    !user?.emailVerified ||
    !activeSession ||
    !ready ||
    dismissedSessionId === activeSession.sessionId ||
    pathname === '/qr-scanner'
  ) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.shell}>
      <HUDBorderBox glow style={styles.prompt} tone="green">
        <TerminalText live="assertive" glow tone="green" variant="label">
          30 MINUTES COMPLETE
        </TerminalText>
        <TerminalText tone="text" uppercase={false} variant="body">
          Return to {activeSession.gymName ?? 'your selected Partner gym'} and verify
          your live location to finish the workout.
        </TerminalText>
        <View style={styles.actions}>
          <CyberButtonPrimary
            label="VERIFY LOCATION TO FINISH ->"
            onPress={() => router.push('/qr-scanner')}
            style={styles.primaryAction}
          />
          <CyberButtonOutline
            label="LATER"
            onPress={() => setDismissedSessionId(activeSession.sessionId)}
            style={styles.laterAction}
          />
        </View>
      </HUDBorderBox>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    left: spacing.md,
    zIndex: 100,
    alignItems: 'center',
    elevation: 20
  },
  prompt: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.sm,
    padding: spacing.lg
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  primaryAction: {
    minWidth: 210,
    flexGrow: 1
  },
  laterAction: {
    minWidth: 96
  }
});
