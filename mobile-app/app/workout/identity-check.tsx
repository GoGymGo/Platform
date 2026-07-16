import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { isGoGymGoPartnerCode } from '@/domain/partnerGymQr';
import { goBackOrReplace } from '@/navigation/goBack';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function IdentityCheckScreen() {
  const router = useRouter();
  const { qrPayload } = useLocalSearchParams<{ qrPayload?: string }>();
  const {
    sessionActionError,
    sessionActionPending,
    startWorkoutSession
  } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const { busy, buttonLabel, message, verify } = usePresenceVerification();

  async function confirmPresence() {
    if (
      await verify() &&
      qrPayload &&
      await startWorkoutSession('partnerGymQr', qrPayload)
    ) {
      router.replace('/workout/active');
    }
  }

  if (!qrPayload || !isGoGymGoPartnerCode(qrPayload, 'entry')) {
    return (
      <SessionUnavailable
        body="Scan a partner-gym entry QR before the device presence check."
        onAction={() => router.replace('/qr-scanner')}
        title="ENTRY QR REQUIRED"
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
      <View style={styles.header}>
        <CyberButtonOutline
          label="BACK"
          onPress={() => goBackOrReplace(router, '/qr-scanner')}
          style={styles.backButton}
        />
        <TerminalText glow style={styles.stepLabel} tone="cyan" variant="label">
          IDENTITY // 2 OF 4
        </TerminalText>
      </View>

      <View style={styles.centerContent}>
        <HUDBorderBox glow style={styles.scanFrame} tone="cyan">
          <TerminalText glow style={styles.scanIcon} tone="cyan" variant="value">
            ID
          </TerminalText>
        </HUDBorderBox>
        <TerminalText glow style={styles.eyebrow} tone="cyan" variant="label">
          LOCAL PRESENCE CHECK
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CONFIRM IT IS REALLY YOU
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          The gym QR confirms where the session starts. Your phone then uses
          its own secure authentication prompt to confirm you are present.
        </TerminalText>
      </View>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={
          !cameraConsentReady ||
          !cameraConsentAccepted ||
          busy ||
          sessionActionPending
        }
        label={sessionActionPending
          ? 'STARTING SESSION...'
          : busy
            ? 'CHECKING DEVICE...'
            : buttonLabel}
        onPress={() => void confirmPresence()}
      />
      {message || sessionActionError ? (
        <TerminalText live="assertive" style={styles.statusMessage} tone="amber" uppercase={false} variant="caption">
          {sessionActionError ?? message}
        </TerminalText>
      ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  stepLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal,
    textAlign: 'right'
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scanFrame: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 34,
    marginBottom: 26,
    ...cyberGlow.cyan
  },
  scanIcon: {
    fontFamily: fontFamilies.display
  },
  eyebrow: {
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  title: {
    maxWidth: 300,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 290,
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  cameraConsent: {
    marginBottom: spacing.md
  },
  statusMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  }
});
