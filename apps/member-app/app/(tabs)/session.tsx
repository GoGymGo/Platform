import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  TerminalText
} from '@/components/cyber';
import { RecoverableScreenError } from '@/components/reliability';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { getWorkoutAccessMode } from '@/domain/workoutAccess';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function SessionTabRoute() {
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
    return <ScreenLoadingState body="Checking your competition setup." />;
  }
  if (setupError) {
    return (
      <RecoverableScreenError
        body="Your competition setup could not be checked. Retry before scanning a gym poster."
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
          SEPTEMBER QR PILOT
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          VERIFY A GYM VISIT
        </TerminalText>
        <TerminalText style={styles.helper} tone="muted" uppercase={false} variant="body">
          Scan the same static GoGymGo poster when you enter and after at least
          30 minutes. Server time and a live 75-metre location check determine
          whether the workout day is verified.
        </TerminalText>
      </View>

      {!setupReady ? (
        <HUDBorderBox glow style={styles.notice} tone="amber">
          <TerminalText glow tone="amber" variant="label">
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
          <TerminalText glow tone="amber" variant="label">
            COMPETITION NOT STARTED
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            QR-verified sessions unlock when the September competition begins.
          </TerminalText>
        </HUDBorderBox>
      ) : (
        <HUDBorderBox glow style={styles.notice} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            STATIC QR READY
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Missing the exit scan earns no competition credit. A gym poster may
            be replaced by an administrator; revoked posters are rejected.
          </TerminalText>
          <CyberButtonPrimary
            label="SCAN GYM QR ->"
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
    maxWidth: 410,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  notice: {
    gap: spacing.md,
    padding: spacing.lg
  }
});
