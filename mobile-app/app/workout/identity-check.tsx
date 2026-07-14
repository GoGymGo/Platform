import { useRouter } from 'expo-router';
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
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function IdentityCheckScreen() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();

  if (!activeSession || activeSession.verificationMethod !== 'partnerGymQr') {
    return (
      <SessionUnavailable
        body="SCAN A PARTNER-GYM ENTRY QR BEFORE THE IDENTITY CHECK."
        onAction={() => router.replace('/qr-scanner')}
        title="ENTRY QR REQUIRED"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
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
          NATIVE BIOMETRIC CHECK
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CONFIRM IT IS REALLY YOU
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          THE GYM QR PROVES WHERE THE SESSION STARTS. THE LOCAL BIOMETRIC
          PROMPT CONFIRMS THE ACCOUNT HOLDER IS PRESENT.
        </TerminalText>
      </View>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={!cameraConsentReady || !cameraConsentAccepted}
        label="CONTINUE TO SESSION ->"
        onPress={() => router.replace('/workout/active')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  }
});
