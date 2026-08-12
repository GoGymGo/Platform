import { Redirect, type Href, useRouter } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  TerminalText
} from '@/components/cyber';
import { RecoverableScreenError } from '@/components/reliability';
import { BrandScreenHeader } from '@/components/screenLayout';
import { colors, spacing } from '@/constants/theme';
import { getWorkoutAccessMode } from '@/domain/workoutAccess';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function SessionTabRoute() {
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (!mobileGymVerificationAvailable) {
    return <Redirect href="/home" />;
  }

  return <MobileSessionTabRoute />;
}

function MobileSessionTabRoute() {
  const router = useRouter();
  const { competition } = useWorkoutProgress();
  const verifiedWorkoutUnavailable = getWorkoutAccessMode(
    competition.phase === 'before-month'
  ) === 'upcoming';
  const {
    checking: setupChecking,
    error: setupError,
    ready: setupReady,
    retry: retrySetup,
    retrying: setupRetrying,
    setupActionLabel,
    setupMessage,
    setupRoute
  } = useSessionRegistrationAccess();

  if (setupChecking) {
    return <ScreenLoadingState body="Checking your Contest." />;
  }
  if (setupError) {
    return (
      <RecoverableScreenError
        body="We couldn&apos;t check your Contest. Try again."
        onRetry={() => void retrySetup()}
        retrying={setupRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <BrandScreenHeader
        description="Start and finish within 75 metres of your selected gym. Train for at least 30 minutes."
        eyebrow="PARTNER GYM PILOT"
        style={styles.header}
        title="VERIFY A GYM VISIT"
      />

      {!setupReady ? (
        <HUDBorderBox style={styles.notice} tone="amber">
          <TerminalText tone="amber" variant="label">
            FINISH SETUP
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {setupMessage}
          </TerminalText>
          <CyberButtonPrimary
            label={setupActionLabel}
            onPress={() => {
              if (setupRoute) router.push(setupRoute as Href);
            }}
          />
        </HUDBorderBox>
      ) : verifiedWorkoutUnavailable ? (
        <HUDBorderBox style={styles.notice} tone="muted">
          <TerminalText tone="amber" variant="label">
            CONTEST NOT STARTED
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Verified workouts unlock when the September Contest begins.
          </TerminalText>
        </HUDBorderBox>
      ) : (
        <HUDBorderBox style={styles.notice} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            GYM LOCATION READY
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Check your location to start. Check again when Finish unlocks.
          </TerminalText>
          <CyberButtonPrimary
            label="START LOCATION CHECK ->"
            onPress={() => router.push('/qr-scanner')}
          />
        </HUDBorderBox>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: 78,
    backgroundColor: colors.transparent
  },
  header: {
    marginBottom: spacing.xxl
  },
  notice: {
    gap: spacing.md,
    padding: spacing.lg
  }
});
