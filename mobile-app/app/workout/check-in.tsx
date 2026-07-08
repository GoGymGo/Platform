import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { BrandVideoAdPlaceholder } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';

export default function CheckInScreen() {
  const router = useRouter();
  const [cameraConsentAccepted, setCameraConsentAccepted] = useState(false);

  return (
    <ScreenContainer>
      <ScrollView
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

        <BrandVideoAdPlaceholder
          compact
          eventLabel="WORKOUT START CHECK-IN"
          onPress={() => router.push('/sponsor-offer')}
          placementLabel="WORKOUT START"
          style={styles.videoAd}
        />

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
            VERIFY IT'S YOU TO START
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" variant="body">
            THE DEVICE CONFIRMS PRESENCE ONLY. GOGYMGO STORES THE CHECKPOINT
            RESULT, NOT FACE DATA OR BIOMETRIC DATA.
          </TerminalText>
        </View>

        <BiometricCameraConsentBanner
          checked={cameraConsentAccepted}
          compact
          onToggle={() => setCameraConsentAccepted((current) => !current)}
          style={styles.cameraConsent}
        />

        <CyberButtonPrimary
          disabled={!cameraConsentAccepted}
          label="VERIFY BIOMETRIC ->"
          onPress={() => router.push('/workout/active')}
        />
      </ScrollView>
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
    minHeight: 40,
    paddingVertical: spacing.sm
  },
  stepLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal,
    textAlign: 'right'
  },
  videoAd: {
    marginBottom: spacing.md
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
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  cameraConsent: {
    marginBottom: spacing.md
  }
});
