import { type Href, useRouter } from 'expo-router';
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
import { getSessionElapsedSeconds, workoutRules } from '@/domain/workoutProgress';
import { useBiometricCameraConsent } from '@/hooks/useBiometricCameraConsent';
import { goBackOrReplace } from '@/navigation/goBack';
import { useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

type CheckoutMetric = {
  label: string;
  value: string;
};

export default function CheckOutScreen() {
  const router = useRouter();
  const { campaign } = useSponsorCampaign();
  const sponsorConfirmed = campaign.status === 'approved';
  const { activeSession } = useWorkoutProgress();
  const {
    accepted: cameraConsentAccepted,
    toggle: toggleCameraConsent
  } = useBiometricCameraConsent();
  const elapsedSeconds = activeSession
    ? getSessionElapsedSeconds(activeSession.startedAt, new Date())
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
        { label: 'FACE CHECK', value: 'PASS' },
        { label: 'GYM QR', value: 'READY' }
      ];

  if (!activeSession || !checkoutReady) {
    return (
      <SessionUnavailable
        actionLabel={activeSession ? 'RETURN TO ACTIVE SESSION ->' : 'START A SESSION ->'}
        body={
          !activeSession
            ? 'START A VERIFIED SESSION BEFORE OPENING CHECK-OUT.'
            : activeSession.verificationMethod === 'heartRate' && !heartRateReady
              ? `MAINTAIN AN AVERAGE OF AT LEAST ${workoutRules.minimumAverageHeartRateBpm} BPM ACROSS THE FULL 30-MINUTE SESSION.`
              : 'THE 30-MINUTE MINIMUM AND AUTOMATIC FACE CHECK MUST BOTH PASS BEFORE CHECK-OUT.'
        }
        onAction={() => {
          if (activeSession) {
            router.replace('/workout/active');
          } else {
            router.replace('/session' as Href);
          }
        }}
        title="CHECK-OUT LOCKED"
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TerminalText glow style={styles.stepLabel} tone="cyan" variant="label">
        CHECK-OUT // 3 OF 3
      </TerminalText>

      <HUDBorderBox style={styles.sponsorCard} tone="muted">
        <View style={[styles.sponsorMark, !sponsorConfirmed ? styles.sponsorMarkPending : null]}>
          <TerminalText glow tone={sponsorConfirmed ? 'pink' : 'cyan'} variant="title">
            {campaign.sponsor.mark}
          </TerminalText>
        </View>
        <View style={styles.sponsorCopy}>
          <TerminalText tone="dim" variant="micro">
            SESSION SPONSOR
          </TerminalText>
          <TerminalText style={styles.sponsorText} tone="text" variant="body">
            {campaign.sponsor.shortName} FUNDS THIS REGIONAL CAMPAIGN.
          </TerminalText>
        </View>
      </HUDBorderBox>

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
        onToggle={toggleCameraConsent}
        style={styles.cameraConsent}
      />

      <CyberButtonPrimary
        disabled
        label="FINAL IDENTITY CHECK REQUIRED"
        onPress={() => undefined}
      />
      <TerminalText style={styles.integrationNote} tone="amber" variant="caption">
        COMPLETION WILL UNLOCK ONLY AFTER THE BACKEND ACCEPTS FINAL VERIFICATION EVIDENCE.
      </TerminalText>

      <CyberButtonOutline
        label="BACK"
        onPress={() => goBackOrReplace(router, '/workout/active')}
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
  sponsorMarkPending: {
    borderColor: colors.borderCyanSoft,
    backgroundColor: colors.surfaceCyanGhost
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
  integrationNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
});
