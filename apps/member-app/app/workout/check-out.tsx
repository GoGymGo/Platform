import { Redirect, type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { BiometricCameraConsentBanner } from '@/components/legal';
import { OnboardingHeader } from '@/components/onboarding';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { sessionTimeScale } from '@/config/runtime';
import { legacyTimedWorkoutFlowAvailable } from '@/config/workoutVerification';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { getSessionElapsedSeconds } from '@/domain/workoutProgress';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { usePresenceVerification } from '@/hooks/usePresenceVerification';
import { goBackOrReplace } from '@/navigation/goBack';
import { useWorkoutProgress } from '@/state/workoutProgress';

type CheckoutMetric = {
  label: string;
  value: string;
};

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function CheckOutScreen() {
  if (!legacyTimedWorkoutFlowAvailable) {
    return <Redirect href="/qr-scanner" />;
  }

  return <LegacyCheckOutScreen />;
}

function LegacyCheckOutScreen() {
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
      activeSession.heartRateSamplesSubmitted >=
        activeSession.requiredHeartRateSamples
  );
  const presenceReady = Boolean(
    activeSession &&
      (!activeSession.presenceCheckRequired || activeSession.midSessionVerified)
  );
  const checkoutReady = Boolean(
    activeSession &&
      presenceReady &&
      elapsedSeconds >= activeSession.minimumSessionSeconds &&
      heartRateReady
  );
  const metrics: readonly CheckoutMetric[] = activeSession?.verificationMethod === 'heartRate'
    ? [
        {
          label: 'DURATION',
          value: formatClock(activeSession.minimumSessionSeconds)
        },
        { label: 'AVG BPM', value: String(activeSession.averageHeartRateBpm) },
        {
          label: 'SAMPLES',
          value:
            `${activeSession.heartRateSamplesSubmitted}/${activeSession.requiredHeartRateSamples}`
        }
      ]
    : [
        {
          label: 'DURATION',
          value: activeSession
            ? formatClock(activeSession.minimumSessionSeconds)
            : '--:--'
        },
        {
          label: 'PRESENCE',
          value: activeSession?.presenceCheckRequired ? 'PASS' : 'NOT REQUIRED'
        },
        { label: 'GYM LOCATION', value: 'READY' }
      ];

  if (!activeSession || !checkoutReady) {
    return (
      <SessionUnavailable
        actionLabel={activeSession ? 'RETURN TO WORKOUT' : 'START A WORKOUT'}
        body={
          !activeSession
            ? 'Start a Verified workout before opening the finish location check.'
            : activeSession.verificationMethod === 'heartRate' && !heartRateReady
              ? 'Wait for the required heart-rate evidence to finish uploading.'
              : `The ${formatClock(activeSession.minimumSessionSeconds)} timer minimum${activeSession.presenceCheckRequired ? ' and automatic presence check' : ''} must pass before completion verification.`
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
    if (!activeSession?.presenceCheckRequired || await verify()) {
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
      <OnboardingHeader
        label="WORKOUT COMPLETION VERIFICATION"
        onBack={() => goBackOrReplace(router, '/workout/active')}
        step="FINISH"
      />
      <WorkoutFlowProgress stage="complete" style={styles.workoutProgress} />

      <View style={styles.centerContent}>
        <HUDBorderBox glow style={styles.successMark} tone="green">
          <TerminalText glow style={styles.successMarkText} tone="green" variant="value">
            OK
          </TerminalText>
        </HUDBorderBox>
        <TerminalText glow style={styles.eyebrow} tone="green" variant="label">
          {formatClock(activeSession.minimumSessionSeconds)} COMPLETE
        </TerminalText>
        <TerminalText style={styles.title} tone="text" variant="title">
          VERIFY + FINISH
        </TerminalText>

        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <HUDBorderBox key={metric.label} style={styles.metricCard} tone="cyan">
              <TerminalText style={styles.metricValue} tone="cyan" variant="body">
                {metric.value}
              </TerminalText>
              <TerminalText style={styles.metricLabel} tone="muted" variant="micro">
                {metric.label}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>
      </View>

      {activeSession.presenceCheckRequired ? (
        <BiometricCameraConsentBanner
          checked={cameraConsentAccepted}
          compact
          onToggle={toggleCameraConsent}
          style={styles.cameraConsent}
        />
      ) : null}

      <CyberButtonPrimary
        disabled={
          activeSession.presenceCheckRequired &&
          (!cameraConsentReady || !cameraConsentAccepted || busy)
        }
        label={
          activeSession.presenceCheckRequired
            ? busy ? 'Checking device...' : 'Verify and finish'
            : 'Finish session'
        }
        onPress={() => void confirmPresence()}
      />
      {message ? (
        <TerminalText live="assertive" style={styles.statusMessage} tone="amber" uppercase={false} variant="caption">
          {message}
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
    backgroundColor: colors.transparent
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
