import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { sessionTimeScale } from '@/config/runtime';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { getSessionElapsedSeconds, workoutRules } from '@/domain/workoutProgress';
import { goBackOrReplace } from '@/navigation/goBack';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function QrScannerModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { activeSession, startWorkoutSession } = useWorkoutProgress();
  const isExitScan = params.mode === 'exit';
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const exitReady = Boolean(
    activeSession?.verificationMethod === 'partnerGymQr' &&
      activeSession.midSessionVerified &&
      getSessionElapsedSeconds(activeSession.startedAt, new Date(), sessionTimeScale) >=
        workoutRules.minimumSessionSeconds
  );

  const ctaLabel = isExitScan
    ? 'SCAN EXIT QR - FINISH ->'
    : 'SCAN ENTRY QR - CONTINUE ->';
  const title = isExitScan ? 'SCAN EXIT QR' : 'SCAN GYM QR';
  const subtitle = isExitScan
    ? 'THE EXIT CODE ENDS THE VERIFIED PARTNER-GYM SESSION.'
    : 'THE ENTRY CODE STARTS THE PARTNER-GYM SESSION BEFORE FACE ID.';
  const stepLabel = isExitScan ? 'EXIT QR // 4 OF 4' : 'ENTRY QR // 1 OF 4';

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
          {stepLabel}
        </TerminalText>
        <CyberButtonOutline
          label="CLOSE"
          onPress={() => goBackOrReplace(
            router,
            isExitScan ? '/workout/active' : '/workout/method'
          )}
          style={styles.closeButton}
        />
      </View>

      <View style={styles.centerContent}>
        <TerminalText glow tone="cyan" variant="label">
          PARTNER GYM QR
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          {title}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          {subtitle}
        </TerminalText>

        <HUDBorderBox glow style={styles.scanFrame} tone="cyan">
          <View style={styles.qrGrid}>
            <View style={styles.qrBlockLarge} />
            <View style={styles.qrBlockSmall} />
            <View style={styles.qrBlockSmall} />
            <View style={styles.qrBlockLarge} />
            <View style={styles.qrBlockSmall} />
            <View style={styles.qrBlockLarge} />
            <View style={styles.qrBlockLarge} />
            <View style={styles.qrBlockSmall} />
            <View style={styles.qrBlockLarge} />
          </View>
        </HUDBorderBox>

        <TerminalText style={styles.note} tone="dim" variant="caption">
          ENTRY AND EXIT SCANS ARE BOTH REQUIRED TO VERIFY THIS SESSION.
        </TerminalText>
      </View>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={!cameraConsentReady || !cameraConsentAccepted || (isExitScan && !exitReady)}
        label={ctaLabel}
        onPress={() => {
          if (!isExitScan) {
            startWorkoutSession('partnerGymQr');
          }
          router.replace(isExitScan ? '/workout/complete' : '/workout/identity-check');
        }}
      />
      {isExitScan && !exitReady ? (
        <TerminalText style={styles.exitHelp} tone="amber" variant="caption">
          EXIT UNLOCKS AFTER 30:00 AND THE MID-SESSION CHECK.
        </TerminalText>
      ) : null}
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
    marginBottom: spacing.lg
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  closeButton: {
    width: 104,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 290,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  scanFrame: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 22,
    marginBottom: spacing.lg,
    ...cyberGlow.cyan
  },
  qrGrid: {
    width: 118,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  qrBlockLarge: {
    width: 34,
    height: 34,
    borderRadius: 5,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  qrBlockSmall: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 5,
    backgroundColor: colors.surfaceCyanSoft
  },
  note: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  cameraConsent: {
    marginBottom: spacing.md
  },
  exitHelp: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  }
});
