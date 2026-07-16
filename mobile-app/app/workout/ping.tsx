import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { SessionUnavailable } from '@/components/session';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { getMidSessionGraceSecondsRemaining } from '@/domain/workoutProgress';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { useWorkoutProgress } from '@/state/workoutProgress';

function formatGrace(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = String(secondsRemaining % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function PingScreen() {
  const router = useRouter();
  const { activeSession, markMidSessionVerified } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const { busy, buttonLabel, message, verify } = usePresenceVerification();
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

  async function confirmPresence() {
    if (!(await verify())) {
      return;
    }

    markMidSessionVerified();
    router.replace('/workout/ping-success');
  }
  if (!activeSession) {
    return (
      <SessionUnavailable
        body="Start a verified session before opening a mid-session presence check."
        onAction={() => router.replace('/session' as Href)}
      />
    );
  }

  if (!activeSession.midSessionCheckPrompted && !activeSession.midSessionVerified) {
    return (
      <SessionUnavailable
        actionLabel="RETURN TO ACTIVE SESSION ->"
        body="The random presence check has not been triggered yet. GoGymGo will send a local alert when it is ready."
        onAction={() => router.replace('/workout/active')}
        title="PRESENCE CHECK ARMED"
      />
    );
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
      <HUDBorderBox glow style={styles.pingPill} tone="amber">
        <View style={styles.pingDot} />
        <TerminalText glow tone="amber" variant="micro">
          AUTOMATIC PRESENCE CHECK // ACTION REQUIRED
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
      <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
        Your random mid-workout check is ready. Complete the secure device
        prompt before the timer ends or this workout cannot count.
      </TerminalText>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={!cameraConsentReady || !cameraConsentAccepted || secondsRemaining === 0 || busy}
        label={busy ? 'CHECKING DEVICE...' : buttonLabel}
        onPress={() => void confirmPresence()}
        tone="amber"
      />
      {message ? (
        <TerminalText live="assertive" style={styles.statusMessage} tone="amber" uppercase={false} variant="caption">
          {message}
        </TerminalText>
      ) : null}

      <CyberButtonOutline
        label="BACK TO SESSION"
        onPress={() => router.replace('/workout/active')}
        style={styles.backButton}
      />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
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
  statusMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  }
});
