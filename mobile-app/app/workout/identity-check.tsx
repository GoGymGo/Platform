import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenLoadingState,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { RecoverableScreenError } from '@/components/reliability';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { isGoGymGoPartnerCode } from '@/domain/partnerGymQr';
import { goBackOrReplace } from '@/navigation/goBack';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useWorkoutProgress } from '@/state/workoutProgress';
import { useAppTour } from '@/state/appTour';
import { isAppTourGymQrPayload } from '@/testing/appTourData';

export default function IdentityCheckScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const { qrPayload } = useLocalSearchParams<{ qrPayload?: string }>();
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

  async function confirmPresence() {
    if (
      await verify() &&
      qrPayload &&
      await startWorkoutSession('partnerGymQr', qrPayload)
    ) {
      router.replace('/workout/active');
    }
  }

  if (
    !qrPayload ||
    (
      !isGoGymGoPartnerCode(qrPayload, 'entry') &&
      !(appTourActive && isAppTourGymQrPayload(qrPayload, 'entry'))
    )
  ) {
    return (
      <SessionUnavailable
        body="Scan a partner-gym entry QR before the device presence check."
        onAction={() => router.replace('/qr-scanner')}
        title="ENTRY QR REQUIRED"
      />
    );
  }

  if (registrationChecking) {
    return <ScreenLoadingState body="Checking your competition registration." />;
  }

  if (registrationError) {
    return (
      <RecoverableScreenError
        body="Your competition setup could not be checked. Retry before confirming the partner-gym entry."
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
          onPress={() => goBackOrReplace(router, '/qr-scanner')}
          style={styles.backButton}
        />
        <TerminalText glow tone="cyan" variant="label">
          WORKOUT CHECK-IN
        </TerminalText>
      </View>
      <WorkoutFlowProgress stage="start" style={styles.workoutProgress} />

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
          CONFIRM IT IS REALLY YOU
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Confirm your presence with your phone&apos;s secure prompt.
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
    marginBottom: spacing.sm
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  workoutProgress: {
    marginBottom: spacing.sm
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
