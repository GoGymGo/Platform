import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { SponsorRail } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function CheckInScreen() {
  const router = useRouter();
  const { startWorkoutSession } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="HOME"
            onPress={() => router.push('/home')}
            style={styles.backButton}
          />
          <TerminalText glow style={styles.stepLabel} tone="cyan" variant="label">
            CHECK-IN // 1 OF 3
          </TerminalText>
        </View>

        <SponsorRail compact />

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
            {"VERIFY IT'S YOU TO START"}
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" variant="body">
            THE DEVICE CONFIRMS PRESENCE ONLY. GOGYMGO STORES THE CHECKPOINT
            RESULT, NOT FACE DATA OR BIOMETRIC DATA.
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
          label="VERIFY BIOMETRIC ->"
          onPress={() => {
            startWorkoutSession('heartRate');
            router.push('/workout/active');
          }}
        />
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
    marginBottom: spacing.md
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl
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
