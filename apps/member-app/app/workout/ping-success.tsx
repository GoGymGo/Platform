import { Redirect, type Href, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { midSessionPresenceVerificationAvailable } from '@/config/workoutVerification';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function PingSuccessScreen() {
  if (!midSessionPresenceVerificationAvailable) {
    return <Redirect href="/qr-scanner" />;
  }

  return <MidSessionPresenceSuccessScreen />;
}

function MidSessionPresenceSuccessScreen() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();

  if (!activeSession?.midSessionVerified) {
    return (
      <SessionUnavailable
        body="Complete the mid-session presence check before opening this confirmation."
        onAction={() => {
          if (activeSession) {
            router.replace('/workout/ping');
          } else {
            router.replace('/session' as Href);
          }
        }}
        title="CHECKPOINT NOT CONFIRMED"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <WorkoutFlowProgress stage="verify" style={styles.workoutProgress} />
      <HUDBorderBox glow style={styles.successMark} tone="green">
        <TerminalText glow style={styles.successMarkText} tone="green" variant="value">
          OK
        </TerminalText>
      </HUDBorderBox>

      <TerminalText glow style={styles.eyebrow} tone="green" variant="label">
        CHECKPOINT CONFIRMED
      </TerminalText>
      <TerminalText glow style={styles.title} tone="green" variant="title">
        YOU ARE GOOD TO KEEP GOING
      </TerminalText>
      <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
        The mid-session presence check passed. Your workout remains eligible.
      </TerminalText>

      <CyberButtonPrimary
        label="BACK TO SESSION"
        onPress={() => router.replace('/workout/active')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.transparent
  },
  workoutProgress: {
    marginBottom: spacing.xxl
  },
  successMark: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 42,
    marginBottom: 18,
    ...cyberGlow.green
  },
  successMarkText: {
    fontFamily: fontFamilies.display
  },
  eyebrow: {
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  title: {
    maxWidth: 310,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 290,
    marginTop: spacing.md,
    marginBottom: 28,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  }
});
