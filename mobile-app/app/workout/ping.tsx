import { type Href, useRouter } from 'expo-router';
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
import { SessionUnavailable } from '@/components/session';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { getMidSessionGraceSecondsRemaining } from '@/domain/workoutProgress';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { useWorkoutProgress } from '@/state/workoutProgress';

function formatGrace(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = String(secondsRemaining % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function PingScreen() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getMidSessionGraceSecondsRemaining(activeSession?.midSessionCheckPromptedAt ?? null)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(
        getMidSessionGraceSecondsRemaining(
          activeSession?.midSessionCheckPromptedAt ?? null
        )
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession?.midSessionCheckPromptedAt]);

  const graceClock = useMemo(
    () => formatGrace(secondsRemaining),
    [secondsRemaining]
  );
  if (!activeSession) {
    return (
      <SessionUnavailable
        body="START A VERIFIED SESSION BEFORE OPENING A MID-SESSION CHECK."
        onAction={() => router.replace('/session' as Href)}
      />
    );
  }

  if (!activeSession.midSessionCheckPrompted && !activeSession.midSessionVerified) {
    return (
      <SessionUnavailable
        actionLabel="RETURN TO ACTIVE SESSION ->"
        body="THE RANDOM FACE CHECK HAS NOT BEEN TRIGGERED YET. KEEP THE ACTIVE SESSION OPEN AND GOGYMGO WILL PROMPT YOU AUTOMATICALLY."
        onAction={() => router.replace('/workout/active')}
        title="FACE CHECK ARMED"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <HUDBorderBox glow style={styles.pingPill} tone="amber">
        <View style={styles.pingDot} />
        <TerminalText glow tone="amber" variant="micro">
          AUTOMATIC FACE CHECK // ACTION REQUIRED
        </TerminalText>
      </HUDBorderBox>

      <HUDBorderBox glow style={styles.timerFrame} tone="amber">
        <View style={styles.timerInner}>
          <TerminalText glow style={styles.timerValue} tone="amber" variant="display">
            {graceClock}
          </TerminalText>
          <TerminalText tone="amber" variant="micro">
            GRACE LEFT
          </TerminalText>
        </View>
      </HUDBorderBox>

      <TerminalText glow style={styles.title} tone="amber" variant="title">
        VERIFY NOW TO KEEP IT VALID
      </TerminalText>
      <TerminalText style={styles.body} tone="muted" variant="body">
        YOUR RANDOM MID-WORKOUT CHECK IS READY. MISS THIS CHECKPOINT AND THIS
        WORKOUT CANNOT COUNT. USE THE LOCAL BIOMETRIC PROMPT, THEN BACK TO IT.
      </TerminalText>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled
        label="IDENTITY PROVIDER REQUIRED"
        onPress={() => undefined}
        tone="amber"
      />
      <TerminalText style={styles.integrationNote} tone="amber" variant="caption">
        THIS CHECKPOINT CANNOT PASS UNTIL VERIFIED PROVIDER EVIDENCE IS RETURNED.
      </TerminalText>

      <CyberButtonOutline
        label="BACK TO SESSION"
        onPress={() => router.replace('/workout/active')}
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
    backgroundColor: colors.statusWarning,
    ...cyberGlow.amber
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
    borderColor: colors.borderWarning,
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
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  backButton: {
    marginTop: spacing.md
  },
  cameraConsent: {
    marginBottom: spacing.md
  },
  integrationNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  }
});
