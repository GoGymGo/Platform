import { Redirect, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenLoadingState,
  ScreenScrollView,
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
import { OnboardingHeader } from '@/components/onboarding';
import { SessionUnavailable } from '@/components/session';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
import { fontFamilies, spacing } from '@/constants/theme';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAppTour } from '@/state/appTour';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function CheckInScreen() {
  if (!heartRateTelemetryAvailable) {
    return <Redirect href="/workout/method" />;
  }

  return <HeartRateCheckInScreen />;
}

function HeartRateCheckInScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
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

  if (!heartRateTelemetryAvailable && !appTourActive) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO TRAIN"
        body="Heart-rate telemetry is not connected in this build, so a Verified workout cannot start yet."
        onAction={() => router.replace('/session')}
        title="DEVICE CONNECTION REQUIRED"
      />
    );
  }

  async function confirmPresence() {
    if (!(await verify())) {
      return;
    }

    if (await startWorkoutSession('heartRate')) {
      router.push('/workout/active');
    }
  }

  if (registrationChecking) {
    return <ScreenLoadingState body="Checking your contest registration." />;
  }

  if (registrationError) {
    return (
      <RecoverableScreenError
        body="Your Contest setup could not be checked. Retry before starting a Verified workout."
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
        <OnboardingHeader
          label="WORKOUT VERIFICATION"
          onBack={() => goBackOrReplace(router, '/session')}
          step="START"
        />
        <WorkoutFlowProgress stage="start" style={styles.workoutProgress} />
        <BrandScreenHeader
          description="Use your phone's secure prompt. GoGymGo receives only pass or fail."
          eyebrow="LOCAL PRESENCE CHECK"
          title="VERIFY IT'S YOU TO START"
        />

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
          <HUDBorderBox style={styles.scanFrame} tone="cyan">
            <TerminalText style={styles.scanIcon} tone="cyan" variant="value">
              ID
            </TerminalText>
          </HUDBorderBox>
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
  screen: brandScreenStyles.content,
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
    marginBottom: spacing.md
  },
  scanIcon: {
    fontFamily: fontFamilies.display
  },
  cameraConsent: {
    marginBottom: spacing.md
  },
  statusMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  }
});
