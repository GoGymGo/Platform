import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { OnboardingHeader } from '@/components/onboarding';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { goBackOrReplace } from '@/navigation/goBack';

const verificationUses = [
  ['IDENTITY', 'Confirm you are present at random checkpoints.'],
  ['WORKOUT', 'Verify session effort or partner-gym entry and exit.'],
  ['REGION', 'Place you in the correct local competition.']
] as const;

export default function ConsentsScreen() {
  const router = useRouter();
  const {
    accepted: biometricConsentAccepted,
    ready: biometricConsentReady,
    toggle: toggleBiometricConsent
  } = useBiometricCameraConsent();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="PERMISSIONS"
          onBack={() => goBackOrReplace(router, '/region')}
          progress={60}
          step="STEP 03 / 05"
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          USED FOR VERIFICATION
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          GoGymGo asks for device access only when a feature needs it. You can
          review or change access in your phone settings.
        </TerminalText>

        <HUDBorderBox style={styles.usePanel} tone="muted">
          {verificationUses.map(([title, detail]) => (
            <View key={title} style={styles.useRow}>
              <View style={styles.useDot} />
              <View style={styles.useCopy}>
                <TerminalText style={styles.useTitle} tone="text" variant="body">
                  {title}
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  {detail}
                </TerminalText>
              </View>
            </View>
          ))}
        </HUDBorderBox>

        <BiometricCameraConsentBanner
          checked={biometricConsentAccepted}
          compact
          onToggle={toggleBiometricConsent}
          style={styles.cameraConsent}
        />

        <View style={styles.actions}>
          <CyberButtonPrimary
            disabled={!biometricConsentReady || !biometricConsentAccepted}
            label={biometricConsentAccepted ? 'CONTINUE ->' : 'ACCEPT & CONTINUE ->'}
            onPress={() => router.push('/verification')}
          />
          {!biometricConsentAccepted ? (
            <TerminalText style={styles.helper} tone="dim" uppercase={false} variant="caption">
              Accept the presence-check notice to continue.
            </TerminalText>
          ) : null}
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  usePanel: {
    marginTop: spacing.xl,
    gap: spacing.md,
    padding: spacing.lg
  },
  useRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  useDot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: colors.cyan
  },
  useCopy: {
    flex: 1
  },
  useTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.button
  },
  cameraConsent: {
    marginTop: spacing.lg
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm
  },
  helper: {
    textAlign: 'center'
  }
});
