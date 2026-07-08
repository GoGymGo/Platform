import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';

export default function PingSuccessScreen() {
  const router = useRouter();

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <HUDBorderBox glow style={styles.successMark} tone="cyan">
        <TerminalText glow style={styles.successMarkText} tone="cyan" variant="value">
          OK
        </TerminalText>
      </HUDBorderBox>

      <TerminalText glow style={styles.eyebrow} tone="cyan" variant="label">
        CHECKPOINT CONFIRMED
      </TerminalText>
      <TerminalText glow style={styles.title} tone="cyan" variant="title">
        YOU ARE GOOD TO KEEP GOING
      </TerminalText>
      <TerminalText style={styles.body} tone="muted" variant="body">
        THE MID-SESSION IDENTITY CHECK PASSED. YOUR WORKOUT REMAINS ELIGIBLE.
      </TerminalText>

      <CyberButtonPrimary
        label="BACK TO SESSION ->"
        onPress={() => router.push('/workout/active')}
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
    ...cyberGlow.cyan
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
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  }
});
