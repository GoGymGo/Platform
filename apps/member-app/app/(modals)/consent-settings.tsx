import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import {
  BiometricCameraConsentBanner,
  DataCollectionNotice
} from '@/components/legal';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { spacing } from '@/constants/theme';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { goBackOrReplace } from '@/navigation/goBack';

export default function ConsentSettingsScreen() {
  const router = useRouter();
  const { accepted, busy, error, ready, toggle } = useBiometricCameraConsent();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={brandScreenStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="CONSENT SETTINGS"
          onBack={() => goBackOrReplace(router, '/profile')}
          step="PRIVACY"
        />
        <BrandScreenHeader
          description="Review and change the device-presence choice used for verified workouts."
          eyebrow="YOUR CHOICE"
          title="DEVICE PRESENCE"
        />

        <BiometricCameraConsentBanner
          checked={accepted}
          onToggle={() => void toggle()}
        />

        <DataCollectionNotice message="GoGymGo stores only the non-biometric result needed to audit a workout. Face ID, fingerprint, passcode data, QR frames, and camera imagery stay off GoGymGo servers." />

        <HUDBorderBox style={styles.statusCard} tone={accepted ? 'green' : 'amber'}>
          <TerminalText tone={accepted ? 'green' : 'amber'} variant="label">
            {!ready
              ? 'LOADING YOUR CHOICE'
              : busy
                ? 'SAVING YOUR CHOICE'
                : accepted
                  ? 'DEVICE PRESENCE ENABLED'
                  : 'DEVICE PRESENCE DECLINED'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Declining does not delete your account, but a workout cannot receive verification credit when a required presence check is unavailable.
          </TerminalText>
          {error ? (
            <TerminalText live="polite" tone="amber" uppercase={false} variant="caption">
              {error}
            </TerminalText>
          ) : null}
        </HUDBorderBox>

        <CyberButtonOutline
          label="READ THE FULL PRESENCE NOTICE"
          onPress={() => router.push('/biometric-camera-consent')}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    gap: spacing.sm,
    padding: spacing.lg
  }
});
