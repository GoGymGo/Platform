import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

function formatGrace(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = String(secondsRemaining % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function PingScreen() {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(108);
  const [cameraConsentAccepted, setCameraConsentAccepted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const graceClock = useMemo(
    () => formatGrace(secondsRemaining),
    [secondsRemaining]
  );

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <HUDBorderBox glow style={styles.pingPill} tone="pink">
        <View style={styles.pingDot} />
        <TerminalText glow tone="pink" variant="micro">
          RANDOM PING // MIN 16:42
        </TerminalText>
      </HUDBorderBox>

      <HUDBorderBox glow style={styles.timerFrame} tone="pink">
        <View style={styles.timerInner}>
          <TerminalText glow style={styles.timerValue} tone="pink" variant="display">
            {graceClock}
          </TerminalText>
          <TerminalText tone="pink" variant="micro">
            GRACE LEFT
          </TerminalText>
        </View>
      </HUDBorderBox>

      <TerminalText glow style={styles.title} tone="pink" variant="title">
        VERIFY NOW TO KEEP IT VALID
      </TerminalText>
      <TerminalText style={styles.body} tone="pink" variant="body">
        MISS THIS CHECKPOINT AND THIS WORKOUT CANNOT COUNT. USE THE LOCAL
        BIOMETRIC PROMPT, THEN BACK TO IT.
      </TerminalText>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={() => setCameraConsentAccepted((current) => !current)}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={!cameraConsentAccepted}
        label="VERIFY BIOMETRIC ->"
        onPress={() => router.push('/workout/ping-success')}
        tone="pink"
      />

      <CyberButtonOutline
        label="BACK TO SESSION"
        onPress={() => router.push('/workout/active')}
        style={styles.backButton}
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
  pingPill: {
    width: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    marginBottom: 32
  },
  pingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.pink,
    ...cyberGlow.pink
  },
  timerFrame: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 85,
    marginBottom: 28
  },
  timerInner: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfacePinkStrong,
    borderRadius: 64
  },
  timerValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.timer,
    lineHeight: 44
  },
  title: {
    maxWidth: 310,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 290,
    marginTop: spacing.md,
    marginBottom: 30,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  backButton: {
    marginTop: spacing.md
  },
  cameraConsent: {
    marginBottom: spacing.md
  }
});
