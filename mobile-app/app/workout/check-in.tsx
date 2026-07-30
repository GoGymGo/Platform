import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenLoadingState,
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import {
  RecoverableScreenError,
  useAccessibilityAnnouncement
} from '@/components/reliability';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function CheckInScreen() {
  const router = useRouter();
  const { deviceSaved } = useLocalSearchParams<{ deviceSaved?: string }>();
  const {
    sessionActionError,
    sessionActionPending,
    startWorkoutSession
  } = useWorkoutProgress();
  const {
    checking: registrationChecking,
    error: registrationError,
    ready: registrationReady,
    retry: retryRegistration,
    retrying: registrationRetrying,
    setupActionLabel,
    setupMessage,
    setupRoute
  } = useSessionRegistrationAccess();
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const { busy, message, verify } = usePresenceVerification();
  useAccessibilityAnnouncement(
    deviceSaved === '1'
      ? 'Default device saved. Next, verify it is you to begin the workout.'
      : null
  );

  async function confirmPresence() {
    if (!(await verify())) {
      return;
    }

    if (await startWorkoutSession('heartRate')) {
      router.push('/workout/active');
    }
  }

  if (registrationChecking) {
    return <ScreenLoadingState body="Checking your competition registration." />;
  }

  if (registrationError) {
    return (
      <RecoverableScreenError
        body="Your competition setup could not be checked. Retry before starting a verified workout."
        onRetry={() => void retryRegistration()}
        retrying={registrationRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }

  if (!registrationReady) {
    return (
      <SessionUnavailable
        actionLabel={setupActionLabel}
        body={setupMessage}
        onAction={() => {
          if (setupRoute) {
            router.replace(setupRoute as Href);
          }
        }}
        title="FINISH SETUP"
      />
    );
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/session')}
            style={styles.backButton}
          />
          <TerminalText glow tone="cyan" variant="label">
            WORKOUT CHECK-IN
          </TerminalText>
        </View>
        <WorkoutFlowProgress stage="start" style={styles.workoutProgress} />

        {deviceSaved === '1' ? (
          <HUDBorderBox style={styles.savedDeviceNotice} tone="green">
            <TerminalText glow live="polite" tone="green" variant="label">
              DEFAULT DEVICE SAVED
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              Next, verify it&apos;s you to begin the workout.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <View style={styles.centerContent}>
          <HUDBorderBox glow style={styles.scanFrame} tone="cyan">
            <TerminalText glow style={styles.scanIcon} tone="cyan" variant="value">
              ID
            </TerminalText>
          </HUDBorderBox>
          <TerminalText glow style={styles.eyebrow} tone="cyan" variant="label">
            LOCAL PRESENCE CHECK
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            {"VERIFY IT'S YOU TO START"}
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Use your phone&apos;s secure prompt. GoGymGo receives only pass or fail.
          </TerminalText>
        </View>

        <BiometricCameraConsentBanner
          checked={cameraConsentAccepted}
          compact
          onToggle={toggleCameraConsent}
          style={styles.cameraConsent}
        />

        <CyberButtonPrimary
          disabled={
            !cameraConsentReady ||
            !cameraConsentAccepted ||
            busy ||
            sessionActionPending
          }
          label={sessionActionPending
              ? 'Starting session...'
            : busy
              ? 'Checking device...'
              : 'Verify and start'}
          onPress={() => void confirmPresence()}
        />
        {message || sessionActionError ? (
          <TerminalText live="assertive" style={styles.statusMessage} tone="amber" uppercase={false} variant="caption">
            {sessionActionError ?? message}
          </TerminalText>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  workoutProgress: {
    marginBottom: spacing.sm
  },
  savedDeviceNotice: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  centerContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg
  },
  scanFrame: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 20,
    marginBottom: spacing.md,
    ...cyberGlow.cyan
  },
  scanIcon: {
    fontFamily: fontFamilies.display
  },
  eyebrow: {
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  title: {
    maxWidth: 300,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 290,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  cameraConsent: {
    marginBottom: spacing.md
  },
  statusMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  }
});
