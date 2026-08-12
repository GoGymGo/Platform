import { Redirect, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenLoadingState,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { RecoverableScreenError } from '@/components/reliability';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { OnboardingHeader } from '@/components/onboarding';
import { SessionUnavailable } from '@/components/session';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { devicePresenceVerificationAvailable } from '@/config/workoutVerification';
import { fontFamilies, spacing } from '@/constants/theme';
import { isGoGymGoPartnerCode } from '@/domain/partnerGymQr';
import { goBackOrReplace } from '@/navigation/goBack';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useWorkoutProgress } from '@/state/workoutProgress';
import { useAppTour } from '@/state/appTour';
import { isAppTourGymQrPayload } from '@/testing/appTourData';

export default function IdentityCheckScreen() {
  if (!devicePresenceVerificationAvailable) {
    return <Redirect href="/qr-scanner" />;
  }

  return <DevicePresenceCheckScreen />;
}

function DevicePresenceCheckScreen() {
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
        body="Select a Partner gym from its Contest QR before the device presence check."
        onAction={() => router.replace('/qr-scanner')}
        title="PARTNER GYM REQUIRED"
      />
    );
  }

  if (registrationChecking) {
    return <ScreenLoadingState body="Checking your contest registration." />;
  }

  if (registrationError) {
    return (
      <RecoverableScreenError
        body="Your Contest setup could not be checked. Retry before confirming the Partner gym entry."
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
        onBack={() => goBackOrReplace(router, '/qr-scanner')}
        step="PARTNER GYM"
      />
      <WorkoutFlowProgress stage="start" style={styles.workoutProgress} />
      <BrandScreenHeader
        description="Confirm your presence with your phone's secure prompt."
        eyebrow="LOCAL PRESENCE CHECK"
        title="CONFIRM IT IS REALLY YOU"
      />

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
