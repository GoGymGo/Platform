import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  TerminalText
} from '@/components/cyber';
import {
  creatorFeaturesEnabled
} from '@/config/features';
import { RecoverableScreenError } from '@/components/reliability';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { getWorkoutAccessMode } from '@/domain/workoutAccess';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useWorkoutVerificationPreference } from '@/hooks/useWorkoutVerificationPreference';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function SessionTabRoute() {
  const router = useRouter();
  const { activeSession, competition } = useWorkoutProgress();
  const competitionNotStarted = competition.phase === 'before-month';
  const workoutAccessMode = getWorkoutAccessMode(competitionNotStarted);
  const verifiedWorkoutUnavailable = workoutAccessMode === 'upcoming';
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
  const {
    ready: verificationPreferenceReady,
    workoutStartRoute
  } = useWorkoutVerificationPreference();

  if (setupChecking || !verificationPreferenceReady) {
    return <ScreenLoadingState body="Checking your workout setup." />;
  }

  if (setupError) {
    return (
      <RecoverableScreenError
        body="Your workout setup could not be checked. Retry before starting a verified session."
        onRetry={() => void retrySetup()}
        retrying={setupRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <TerminalText glow tone="cyan" variant="label">
          SESSION START
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CHOOSE YOUR WORKOUT
        </TerminalText>
        <TerminalText style={styles.helper} tone="muted" uppercase={false} variant="body">
          {activeSession
            ? 'Your verified workout is still running. Return to the timer to continue.'
            : creatorFeaturesEnabled
              ? 'Choose a creator workout or use your own plan. Both use the same verification.'
              : 'Use your own workout plan and GoGymGo will guide you through verification.'}
        </TerminalText>
      </View>

      {!setupReady ? (
        <HUDBorderBox glow style={styles.setupNotice} tone="amber">
          <TerminalText glow tone="amber" variant="label">
            FINISH SETUP
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {setupMessage}
          </TerminalText>
          <CyberButtonPrimary
            label={setupActionLabel}
            onPress={() => {
              if (setupRoute) {
                router.push(setupRoute as Href);
              }
            }}
          />
        </HUDBorderBox>
      ) : verifiedWorkoutUnavailable ? (
        <HUDBorderBox style={styles.previewNotice} tone="muted">
          <TerminalText glow tone="amber" variant="label">COMPETITION NOT STARTED</TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Verified sessions unlock when the competition begins.
          </TerminalText>
        </HUDBorderBox>
      ) : null}

      {setupReady ? <View style={styles.actions}>
        {activeSession ? (
          <CyberButtonPrimary
            label="Return to workout"
            onPress={() => router.push('/workout/active')}
          />
        ) : (
          <>
            {creatorFeaturesEnabled ? (
              <CyberButtonPrimary
                label="Choose a creator workout"
                onPress={() => router.push('/workouts?source=session' as Href)}
                tone="cyan"
              />
            ) : null}
            <CyberButtonPrimary
              disabled={verifiedWorkoutUnavailable}
              label={verifiedWorkoutUnavailable ? 'Workouts not started' : 'Start my own workout'}
              onPress={() => router.push(workoutStartRoute)}
            />
          </>
        )}
      </View> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xxl,
    paddingBottom: 78,
    backgroundColor: colors.background
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  helper: {
    maxWidth: 390,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  setupNotice: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  actions: {
    gap: spacing.md
  },
  previewNotice: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.lg
  }
});
