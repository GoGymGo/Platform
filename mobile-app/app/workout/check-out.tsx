import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';

type CheckoutMetric = {
  label: string;
  value: string;
};

const metrics: readonly CheckoutMetric[] = [
  { label: 'MIN ELEVATED', value: '22' },
  { label: 'AVG BPM', value: '138' },
  { label: 'CHECKPOINTS', value: '3/3' }
];

export default function CheckOutScreen() {
  const router = useRouter();
  const [cameraConsentAccepted, setCameraConsentAccepted] = useState(false);

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TerminalText glow style={styles.stepLabel} tone="cyan" variant="label">
        CHECK-OUT // 3 OF 3
      </TerminalText>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/sponsor-offer')}
        style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
      >
        <HUDBorderBox style={styles.sponsorCard} tone="muted">
          <View style={styles.sponsorMark}>
            <TerminalText glow tone="pink" variant="title">
              V
            </TerminalText>
          </View>
          <View style={styles.sponsorCopy}>
            <TerminalText tone="dim" variant="micro">
              SESSION SPONSOR
            </TerminalText>
            <TerminalText style={styles.sponsorText} tone="text" variant="body">
              VOLT FUNDS VERIFIED SESSION ENTRIES.
            </TerminalText>
          </View>
        </HUDBorderBox>
      </Pressable>

      <View style={styles.centerContent}>
        <HUDBorderBox glow style={styles.successMark} tone="cyan">
          <TerminalText glow style={styles.successMarkText} tone="cyan" variant="value">
            OK
          </TerminalText>
        </HUDBorderBox>
        <TerminalText glow style={styles.eyebrow} tone="cyan" variant="label">
          30:00 COMPLETE
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          FINAL CHECKPOINT. LOCK THE SESSION.
        </TerminalText>

        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <HUDBorderBox key={metric.label} style={styles.metricCard} tone="cyan">
              <TerminalText glow style={styles.metricValue} tone="cyan" variant="body">
                {metric.value}
              </TerminalText>
              <TerminalText style={styles.metricLabel} tone="muted" variant="micro">
                {metric.label}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>
      </View>

      <BiometricCameraConsentBanner
        checked={cameraConsentAccepted}
        compact
        onToggle={() => setCameraConsentAccepted((current) => !current)}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={!cameraConsentAccepted}
        label="VERIFY BIOMETRIC - FINISH ->"
        onPress={() => router.push('/workout/complete')}
      />

      <CyberButtonOutline
        label="BACK"
        onPress={() => router.push('/workout/active')}
        style={styles.backButton}
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
  stepLabel: {
    marginBottom: 6,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  pressableCard: {
    width: '100%'
  },
  sponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 14,
    marginBottom: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14
  },
  sponsorMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 9,
    backgroundColor: colors.surfacePinkSoft
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorText: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  successMark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 38,
    marginBottom: 18,
    ...cyberGlow.cyan
  },
  successMarkText: {
    fontFamily: fontFamilies.display
  },
  eyebrow: {
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  title: {
    maxWidth: 310,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xxl
  },
  metricCard: {
    flex: 1,
    minWidth: 88,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm
  },
  metricValue: {
    fontFamily: fontFamilies.display
  },
  metricLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  backButton: {
    marginTop: 10,
    minHeight: 44,
    paddingVertical: 11
  },
  cameraConsent: {
    marginBottom: spacing.md
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
