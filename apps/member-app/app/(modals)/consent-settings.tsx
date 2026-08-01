import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { biometricConsentCopy } from '@/constants/legal';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { goBackOrReplace } from '@/navigation/goBack';

export default function ConsentSettingsScreen() {
  const router = useRouter();
  const { accepted, busy, error, ready, setAccepted } = useBiometricCameraConsent();
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [message, setMessage] = useState<string>();

  if (!ready) {
    return <ScreenLoadingState body="Loading your current consent setting." />;
  }

  async function updateConsent(nextAccepted: boolean) {
    setMessage(undefined);
    const updated = await setAccepted(nextAccepted);

    if (updated) {
      setConfirmWithdrawal(false);
      setMessage(
        nextAccepted
          ? 'CONSENT RECORDED. VERIFIED WORKOUT CHECKS ARE AVAILABLE.'
          : 'CONSENT WITHDRAWN. VERIFIED WORKOUT CHECKS ARE NOW DISABLED.'
      );
    }
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            CONSENT SETTINGS
          </TerminalText>
          <CyberButtonOutline
            label="CLOSE"
            onPress={() => goBackOrReplace(router, '/profile')}
            style={styles.closeButton}
          />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          DEVICE PRESENCE + QR CAMERA
        </TerminalText>
        <TerminalText style={styles.intro} tone="muted" uppercase={false} variant="body">
          Manage whether GoGymGo may ask your device to confirm your presence
          during a verified workout. Your choice is saved to your account.
        </TerminalText>

        <HUDBorderBox glow={accepted} style={styles.statusCard} tone={accepted ? 'green' : 'red'}>
          <TerminalText glow tone={accepted ? 'green' : 'red'} variant="label">
            {accepted ? 'CONSENT ACTIVE' : 'CONSENT WITHDRAWN'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {accepted
              ? 'Device presence and partner-gym QR verification may be offered when a workout requires them.'
              : 'GoGymGo will not start device presence or partner-gym QR verification. Verified workouts remain unavailable until you consent again.'}
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.noticeCard} tone="muted">
          <TerminalText tone="text" variant="label">
            WHAT YOU ARE AGREEING TO
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {biometricConsentCopy.checkbox}
          </TerminalText>
          <TerminalText tone="dim" uppercase={false} variant="caption">
            {"This account setting is separate from camera or biometric permission prompts controlled by your phone's operating system."}
          </TerminalText>
          <CyberButtonOutline
            label="VIEW FULL NOTICE ->"
            onPress={() => router.push('/biometric-camera-consent' as Href)}
          />
        </HUDBorderBox>

        {accepted ? (
          confirmWithdrawal ? (
            <HUDBorderBox style={styles.confirmCard} tone="red">
              <TerminalText glow tone="red" variant="label">
                CONFIRM WITHDRAWAL
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Withdrawing consent disables verified workout check-in,
                mid-session presence checks, check-out and partner-gym QR verification.
              </TerminalText>
              <View style={styles.confirmActions}>
                <CyberButtonOutline
                  disabled={busy}
                  label="KEEP CONSENT"
                  onPress={() => setConfirmWithdrawal(false)}
                  style={styles.confirmButton}
                />
                <CyberButtonOutline
                  disabled={busy}
                  label={busy ? 'WITHDRAWING...' : 'CONFIRM WITHDRAWAL'}
                  onPress={() => void updateConsent(false)}
                  style={styles.confirmButton}
                  tone="red"
                />
              </View>
            </HUDBorderBox>
          ) : (
            <CyberButtonOutline
              disabled={busy}
              label="WITHDRAW CONSENT"
              onPress={() => setConfirmWithdrawal(true)}
              tone="red"
            />
          )
        ) : (
          <CyberButtonPrimary
            disabled={busy}
            label={busy ? 'RECORDING CONSENT...' : 'GIVE CONSENT ->'}
            onPress={() => void updateConsent(true)}
          />
        )}

        {message || error ? (
          <TerminalText
            live="polite"
            style={styles.message}
            tone={error ? 'amber' : 'green'}
            uppercase={false}
            variant="caption"
          >
            {error ?? message}
          </TerminalText>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  closeButton: {
    minHeight: 44,
    width: 104
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display
  },
  intro: {
    fontFamily: fontFamilies.body
  },
  statusCard: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  noticeCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  confirmCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  confirmButton: {
    flex: 1
  },
  message: {
    textAlign: 'center'
  }
});
