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
    return <ScreenLoadingState body="Checking your contest setup." />;
  }
  if (setupError) {
    return (
      <RecoverableScreenError
        body="Your Contest setup could not be checked. Retry before starting a gym location check."
        onRetry={() => void retrySetup()}
        retrying={setupRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <BrandScreenHeader
        description="The gym selected during registration is reused automatically. A fresh 75-metre location check is required when you start and finish, with at least 30 minutes measured by server time. Workouts started in time may finish during the 15-minute completion period after the Contest ends."
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
            Check your live location to start the timer, then check it again when
            Finish Workout unlocks. Workout verification uses fresh location checks.
          </TerminalText>
          <CyberButtonPrimary
            label="CHECK GYM LOCATION ->"
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
