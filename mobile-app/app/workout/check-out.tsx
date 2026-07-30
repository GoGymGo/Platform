import { type Href, useRouter } from 'expo-router';
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
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { sessionTimeScale } from '@/config/runtime';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { getSessionElapsedSeconds, workoutRules } from '@/domain/workoutProgress';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { goBackOrReplace } from '@/navigation/goBack';
import { useWorkoutProgress } from '@/state/workoutProgress';

type CheckoutMetric = {
  label: string;
  value: string;
};

export default function CheckOutScreen() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    ready: cameraConsentReady,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const { busy, message, verify } = usePresenceVerification();
  const elapsedSeconds = activeSession
    ? getSessionElapsedSeconds(activeSession.startedAt, new Date(), sessionTimeScale)
    : 0;
  const heartRateReady = activeSession?.verificationMethod !== 'heartRate' || Boolean(
    activeSession &&
      activeSession.heartRateObservedSeconds >= workoutRules.minimumSessionSeconds &&
      activeSession.averageHeartRateBpm >= workoutRules.minimumAverageHeartRateBpm
  );
  const checkoutReady = Boolean(
    activeSession?.midSessionVerified &&
      elapsedSeconds >= workoutRules.minimumSessionSeconds &&
      heartRateReady
  );
  const metrics: readonly CheckoutMetric[] = activeSession?.verificationMethod === 'heartRate'
    ? [
        { label: 'DURATION', value: '30:00' },
        { label: 'AVG BPM', value: String(activeSession.averageHeartRateBpm) },
        { label: 'TARGET', value: `${workoutRules.minimumAverageHeartRateBpm}+` }
      ]
    : [
        { label: 'DURATION', value: '30:00' },
        { label: 'PRESENCE', value: 'PASS' },
        { label: 'GYM QR', value: 'READY' }
      ];

  if (!activeSession || !checkoutReady) {
    return (
      <SessionUnavailable
        actionLabel={activeSession ? 'RETURN TO WORKOUT' : 'START A WORKOUT'}
        body={
          !activeSession
            ? 'Start a verified session before opening check-out.'
            : activeSession.verificationMethod === 'heartRate' && !heartRateReady
              ? `Maintain an average of at least ${workoutRules.minimumAverageHeartRateBpm} BPM across the full 30-minute session.`
              : 'The 30-minute minimum and automatic presence check must both pass before check-out.'
        }
        onAction={() => {
          if (activeSession) {
            router.replace('/workout/active');
          } else {
            router.replace('/session' as Href);
          }
        }}
        title="ACTION NEEDED"
      />
    );
  }

  async function confirmPresence() {
    if (await verify()) {
      router.push('/workout/complete');
    }
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
      <WorkoutFlowProgress stage="complete" style={styles.workoutProgress} />

      <View style={styles.centerContent}>
        <HUDBorderBox glow style={styles.successMark} tone="green">
          <TerminalText glow style={styles.successMarkText} tone="green" variant="value">
            OK
          </TerminalText>
        </HUDBorderBox>
        <TerminalText glow style={styles.eyebrow} tone="green" variant="label">
          30:00 COMPLETE
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          VERIFY + FINISH
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
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled={!cameraConsentReady || !cameraConsentAccepted || busy}
        label={busy ? 'Checking device...' : 'Verify and finish'}
        onPress={() => void confirmPresence()}
      />
      {message ? (
        <TerminalText live="assertive" style={styles.statusMessage} tone="amber" uppercase={false} variant="caption">
          {message}
        </TerminalText>
      ) : null}

      <CyberButtonOutline
        label="BACK"
        onPress={() => goBackOrReplace(router, '/workout/active')}
        style={styles.backButton}
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
  workoutProgress: {
    marginBottom: spacing.lg
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
    ...cyberGlow.green
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
  statusMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  }
});
