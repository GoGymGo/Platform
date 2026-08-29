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
import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
import { formatCompetitionOpeningDateTime } from '@/domain/competition';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import {
  getWorkoutAccessMode,
  getWorkoutSessionContinuity
} from '@/domain/workoutAccess';
import { usePendingGymScanSession } from '@/hooks/usePendingGymScanSession';
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
  const { activeSession, competition, competitionTimeZone } = useWorkoutProgress();
  const {
    activeSession: pendingGymScanSession,
    ready: pendingGymScanSessionReady
  } = usePendingGymScanSession();
  const {
    checking: setupChecking,
    currentCompetition,
    error: setupError,
    ready: setupReady,
    retry: retrySetup,
    retrying: setupRetrying,
    setupActionLabel,
    setupMessage,
    setupRoute
  } = useSessionRegistrationAccess();
  const verifiedWorkoutUnavailable = getWorkoutAccessMode(
    currentCompetition
      ? currentCompetition.status !== 'active'
      : competition.phase === 'before-month'
  ) === 'upcoming';
  const competitionOpeningDateTime = currentCompetition
    ? formatCompetitionOpeningDateTime(
        currentCompetition.startsAt,
        competitionTimeZone
      )
    : null;
  const workoutSessionContinuity = getWorkoutSessionContinuity({
    gymScanSessionActive: pendingGymScanSession !== null,
    gymScanSessionReady: pendingGymScanSessionReady,
    workoutProgressSessionActive: activeSession !== null
  });
  const activeWorkoutRoute =
    activeSession?.verificationMethod === 'heartRate' && heartRateTelemetryAvailable
      ? '/workout/active'
      : '/qr-scanner';

  if (
    workoutSessionContinuity === 'checking' ||
    (setupChecking && workoutSessionContinuity !== 'active-session')
  ) {
    return <ScreenLoadingState body="Checking your Contest." />;
  }
  if (setupError && workoutSessionContinuity !== 'active-session') {
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

      {workoutSessionContinuity === 'active-session' ? (
        <HUDBorderBox style={styles.notice} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            WORKOUT IN PROGRESS
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Your original workout timer is still running. Return to it instead of starting again.
          </TerminalText>
          <CyberButtonPrimary
            label="RETURN TO WORKOUT ->"
            onPress={() => router.push(activeWorkoutRoute)}
          />
        </HUDBorderBox>
      ) : !setupReady ? (
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
            {competitionOpeningDateTime
              ? `Start your workout at ${competitionOpeningDateTime}.`
              : 'Verified workouts unlock when the Contest begins.'}
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
