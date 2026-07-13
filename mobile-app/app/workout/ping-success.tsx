import { type Href, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SessionUnavailable } from '@/components/session';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function PingSuccessScreen() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();

  if (!activeSession?.midSessionVerified) {
    return (
      <SessionUnavailable
        body="COMPLETE THE MID-SESSION IDENTITY CHECK BEFORE OPENING THIS CONFIRMATION."
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
      <TerminalText style={styles.body} tone="muted" variant="body">
        THE MID-SESSION IDENTITY CHECK PASSED. YOUR WORKOUT REMAINS ELIGIBLE.
      </TerminalText>

      <CyberButtonPrimary
        label="BACK TO SESSION ->"
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
    backgroundColor: colors.background
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
