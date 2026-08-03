import { type Href, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  StyleSheet,
  View
} from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenScrollView,
  ScreenContainer,
  ScreenLoadingState,
  TerminalText
} from '@/components/cyber';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { sessionTimeScale } from '@/config/runtime';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { getSessionElapsedSeconds } from '@/domain/workoutProgress';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { useAppTour } from '@/state/appTour';
import { appTourSimulatedHeartRateBpm } from '@/testing/appTourData';
import { formatDateKey, useWorkoutProgress } from '@/state/workoutProgress';

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function ActiveWorkoutScreen() {
  useKeepAwake('gogymgo-active-workout', { suppressDeactivateWarnings: true });
  const reduceMotion = useReducedMotionPreference();
  const router = useRouter();
  const {
    active: appTourActive,
    demoActive
  } = useAppTour();
  const {
    activeSession,
    cancelActiveWorkout,
    midSessionAlertsReady,
    sessionActionError,
    sessionActionPending,
    triggerMidSessionCheck
  } = useWorkoutProgress();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [showSessionOptions, setShowSessionOptions] = useState(false);
  const cancelDialogRef = useRef<View>(null);
  const activeSessionStartedAt = activeSession?.startedAt;
  const activeSessionMinimumSeconds =
    activeSession?.minimumSessionSeconds ?? 1;

  useEffect(() => {
    if (!activeSessionStartedAt) {
      return undefined;
    }

    const updateElapsedTime = () => {
      setElapsedSeconds(
        Math.min(
          getSessionElapsedSeconds(
            activeSessionStartedAt,
            new Date(),
            sessionTimeScale
          ),
          activeSessionMinimumSeconds
        )
      );
    };

    updateElapsedTime();
    const timer = setInterval(() => {
      updateElapsedTime();
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSessionMinimumSeconds, activeSessionStartedAt]);

  const session = useMemo(() => {
    const progressPercent = Math.min(
      100,
      Math.round((elapsedSeconds / activeSessionMinimumSeconds) * 100)
    );
    const minimumReached = elapsedSeconds >= activeSessionMinimumSeconds;
    const presenceReady = Boolean(
      activeSession &&
        (!activeSession.presenceCheckRequired || activeSession.midSessionVerified)
    );
    const heartRateReady = activeSession?.verificationMethod !== 'heartRate' || Boolean(
      activeSession &&
        activeSession.heartRateSamplesSubmitted >=
          activeSession.requiredHeartRateSamples
    );
    const missingHeartRateSamples = activeSession?.verificationMethod === 'heartRate'
      ? Math.max(
          0,
          activeSession.requiredHeartRateSamples -
            activeSession.heartRateSamplesSubmitted
        )
      : 0;

    return {
      averageHeartRate: activeSession?.averageHeartRateBpm ?? 0,
      clock: formatClock(elapsedSeconds),
      finishCta:
        minimumReached && presenceReady && heartRateReady
          ? 'Verify and finish'
          : minimumReached
            ? !presenceReady
              ? 'Presence check required'
              : `${missingHeartRateSamples} heart-rate samples remaining`
            : `Available at ${formatClock(activeSessionMinimumSeconds)}`,
      heartRate: appTourActive
        ? activeSession?.averageHeartRateBpm ?? appTourSimulatedHeartRateBpm
        : 0,
      telemetryAvailable: appTourActive,
      heartRateReady,
      progressPercent,
      ready: minimumReached && presenceReady && heartRateReady
    };
  }, [
    activeSession,
    activeSessionMinimumSeconds,
    appTourActive,
    elapsedSeconds
  ]);

  useEffect(() => {
    if (
      activeSession &&
      activeSession.presenceCheckRequired &&
      !activeSession.midSessionCheckPrompted &&
      !activeSession.midSessionVerified &&
      elapsedSeconds >= activeSession.midSessionCheckAtSeconds
    ) {
      triggerMidSessionCheck();
      router.replace('/workout/ping');
    }
  }, [activeSession, elapsedSeconds, router, triggerMidSessionCheck]);

  const progressWidth = `${session.progressPercent}%` as `${number}%`;

  if (!activeSession) {
    if (demoActive) {
      return <ScreenLoadingState body="Loading the sample workout." />;
    }

    return (
      <SessionUnavailable
        body="Start from the Session tab so check-in, the timer, and verification checkpoints can be tracked together."
        onAction={() => router.replace('/session' as Href)}
      />
    );
  }

  const isHeartRateVerification = activeSession.verificationMethod === 'heartRate';
  const heartRateTone: 'green' | 'amber' = session.telemetryAvailable
    ? 'green'
    : 'amber';
  const heartRateStatus = !session.telemetryAvailable
    ? 'NO DEVICE CONNECTED'
    : 'LIVE SIGNAL';
  const presenceTone: 'cyan' | 'green' | 'amber' =
    !activeSession.presenceCheckRequired
      ? 'green'
      : activeSession.midSessionVerified
    ? 'green'
    : activeSession.midSessionCheckPrompted
      ? 'amber'
      : 'cyan';
  const presenceValue = !activeSession.presenceCheckRequired
    ? 'NOT REQUIRED'
    : activeSession.midSessionVerified
    ? 'COMPLETE'
    : activeSession.midSessionCheckPrompted
      ? 'ACTION NEEDED'
      : 'IN PROGRESS';
  const alertTone: 'cyan' | 'green' | 'amber' =
    !activeSession.presenceCheckRequired
      ? 'green'
      : activeSession.midSessionVerified
    ? 'green'
    : activeSession.midSessionCheckPrompted
      ? 'amber'
      : 'cyan';
  const alertValue = !activeSession.presenceCheckRequired
    ? 'NOT REQUIRED'
    : activeSession.midSessionVerified
    ? 'COMPLETE'
    : activeSession.midSessionCheckPrompted
      ? 'ACTION NEEDED'
      : midSessionAlertsReady
        ? 'READY'
        : 'IN PROGRESS';

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <View style={styles.sessionHeading}>
          <View style={styles.recordingDot} />
          <TerminalText glow tone="cyan" variant="micro">
            SESSION ACTIVE
          </TerminalText>
        </View>
        <TerminalText style={styles.headerLabel} tone="muted" variant="label">
          {isHeartRateVerification ? 'HEART RATE' : 'PARTNER GYM QR'}
        </TerminalText>
      </View>
      <WorkoutFlowProgress stage="verify" style={styles.workoutFlowProgress} />

      <HUDBorderBox glow style={styles.livePanel} tone="cyan">
        <View style={styles.liveMetrics}>
          <View style={styles.timerMetric}>
            <TerminalText tone="dim" variant="micro">
              ELAPSED TIME
            </TerminalText>
            <TerminalText glow style={styles.clock} tone="cyan" variant="display">
              {session.clock}
            </TerminalText>
            <TerminalText style={styles.minimumLabel} tone="muted" variant="micro">
              {formatClock(activeSession.minimumSessionSeconds)} MINIMUM
            </TerminalText>
          </View>

          <View style={styles.metricDivider} />

          <View
            accessible
            accessibilityLabel={session.telemetryAvailable
              ? `Live heart rate ${session.heartRate} beats per minute. ${heartRateStatus}.`
              : 'Live heart rate unavailable. No device connected.'}
            style={styles.heartRateMetric}
          >
            <TerminalText tone="dim" variant="micro">
              LIVE HEART RATE
            </TerminalText>
            <View style={styles.heartRateValueRow}>
              <TerminalText glow style={styles.heartRateValue} tone={heartRateTone} variant="display">
                {session.telemetryAvailable ? session.heartRate : '--'}
              </TerminalText>
              <TerminalText style={styles.bpmLabel} tone="muted" variant="micro">
                BPM
              </TerminalText>
            </View>
            <TerminalText glow tone={heartRateTone} variant="micro">
              {heartRateStatus}
            </TerminalText>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.progressLabels}>
            <TerminalText tone="dim" variant="micro">
              START
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              CHECK
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              END
            </TerminalText>
          </View>
        </View>
      </HUDBorderBox>

      {activeSession.verificationMethod === 'heartRate' && !session.telemetryAvailable ? (
        <HUDBorderBox style={styles.telemetryNotice} tone="amber">
          <TerminalText glow tone="amber" variant="label">
            LIVE HEART-RATE SOURCE NOT CONNECTED
          </TerminalText>
          <TerminalText style={styles.telemetryNoticeCopy} tone="muted" uppercase={false} variant="body">
            Connected device telemetry is required before this session can be verified.
          </TerminalText>
        </HUDBorderBox>
      ) : null}

      <HUDBorderBox style={styles.verificationPanel} tone={session.ready ? 'green' : 'cyan'}>
        <View style={styles.verificationHeader}>
          <View style={styles.verificationHeadingCopy}>
            <TerminalText tone="dim" variant="micro">
              VERIFICATION
            </TerminalText>
            <TerminalText glow tone={session.ready ? 'green' : 'cyan'} variant="label">
              {isHeartRateVerification ? 'HEART RATE SESSION' : 'PARTNER GYM CHECK-IN'}
            </TerminalText>
          </View>
          <TerminalText tone={session.ready ? 'green' : 'cyan'} variant="micro">
            {session.ready ? 'COMPLETE' : 'IN PROGRESS'}
          </TerminalText>
        </View>

        <TerminalText tone="muted" uppercase={false} variant="body">
          Your timer and verification progress save automatically. Keep moving;
          GoGymGo will tell you when an action is needed.
        </TerminalText>

        <CyberButtonOutline
          label={showSessionDetails ? 'HIDE SESSION DETAILS' : 'VIEW SESSION DETAILS'}
          onPress={() => setShowSessionDetails((visible) => !visible)}
        />

        {showSessionDetails ? (
          <>
            <View style={styles.verificationGrid}>
              {isHeartRateVerification ? (
                <>
                  <SessionStatusCell
                    label="AVG BPM"
                    tone={session.heartRateReady ? 'green' : 'cyan'}
                    value={activeSession.heartRateObservedSeconds > 0
                      ? `${session.averageHeartRate} BPM`
                      : '-- BPM'}
                  />
                  <SessionStatusCell
                    label="SAMPLES"
                    tone={session.heartRateReady ? 'green' : 'amber'}
                    value={`${activeSession.heartRateSamplesSubmitted}/${activeSession.requiredHeartRateSamples}`}
                  />
                </>
              ) : (
                <>
                  <SessionStatusCell label="ENTRY QR" tone="green" value="COMPLETE" />
                  <SessionStatusCell label="EXIT QR" tone="cyan" value="ACTION NEEDED" />
                </>
              )}
              <SessionStatusCell label="PRESENCE" tone={presenceTone} value={presenceValue} />
              <SessionStatusCell label="ALERT" tone={alertTone} value={alertValue} />
            </View>

            <View style={styles.saveFooter}>
              <TerminalText tone="dim" variant="micro">
                SESSION SAVE
              </TerminalText>
              <TerminalText tone="cyan" variant="micro">
                AUTO-SAVED // {formatDateKey(activeSession.dateKey).toUpperCase()}
              </TerminalText>
            </View>
          </>
        ) : null}
      </HUDBorderBox>

      <CyberButtonPrimary
        disabled={!session.ready}
        label={session.finishCta}
        onPress={() => router.push('/workout/check-out')}
        tone={session.ready ? 'green' : 'cyan'}
      />

      {activeSession.midSessionCheckPrompted && !activeSession.midSessionVerified ? (
        <View style={styles.actionRow}>
          <CyberButtonOutline
            label="Verify now"
            onPress={() => router.push('/workout/ping')}
            style={styles.actionButton}
            tone="amber"
          />
        </View>
      ) : null}

      <CyberButtonOutline
        accessibilityHint="Return Home while this workout continues in the background"
        label="Leave timer running"
        onPress={() => {
          router.replace('/home');
        }}
        style={styles.backButton}
      />
      <TerminalText live="polite" style={styles.alertHelp} tone="muted" uppercase={false} variant="caption">
        You can leave this screen. Return when notified for a presence check.
      </TerminalText>

      <CyberButtonOutline
        accessibilityHint="Show secondary controls for this workout"
        label={showSessionOptions ? 'HIDE SESSION OPTIONS' : 'SESSION OPTIONS'}
        onPress={() => setShowSessionOptions((visible) => !visible)}
        style={styles.sessionOptionsButton}
      />
      {showSessionOptions ? (
        <HUDBorderBox style={styles.sessionOptionsPanel} tone="red">
          <TerminalText tone="muted" uppercase={false} variant="caption">
            Only end the session if you want to discard this workout&apos;s progress.
          </TerminalText>
          <CyberButtonOutline
            accessibilityHint="Cancel this workout without earning verification credit"
            label="End without saving"
            onPress={() => setShowCancelConfirm(true)}
            tone="red"
          />
        </HUDBorderBox>
      ) : null}
      </ScreenScrollView>

      <Modal
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowCancelConfirm(false)}
        onShow={() => {
          if (Platform.OS === 'web') {
            const dialog = cancelDialogRef.current as unknown as { focus?: () => void };
            dialog.focus?.();
            return;
          }

          const node = findNodeHandle(cancelDialogRef.current);
          if (node) {
            AccessibilityInfo.setAccessibilityFocus(node);
          }
        }}
        transparent
        visible={showCancelConfirm}
      >
        <View style={styles.modalOverlay}>
          <View
            accessibilityLabel="Cancel workout confirmation"
            accessibilityRole="alert"
            accessibilityViewIsModal
            ref={cancelDialogRef}
            style={styles.modalDialog}
            tabIndex={-1}
          >
            <HUDBorderBox glow style={styles.confirmCard} tone="red">
              <TerminalText glow tone="red" variant="label">
                END WORKOUT WITHOUT SAVING?
              </TerminalText>
              <TerminalText style={styles.confirmCopy} tone="text" uppercase={false} variant="body">
                Progress from this workout will not count. This cannot be undone.
              </TerminalText>
              <View style={styles.confirmRow}>
                <CyberButtonOutline
                  label="Keep workout running"
                  onPress={() => setShowCancelConfirm(false)}
                  style={styles.confirmButton}
                />
                <CyberButtonOutline
                  disabled={sessionActionPending}
                  label="End without saving"
                  onPress={() => {
                    void cancelActiveWorkout().then((cancelled) => {
                      if (cancelled) {
                        setShowCancelConfirm(false);
                        router.replace('/home');
                      }
                    });
                  }}
                  style={styles.confirmButton}
                  tone="red"
                />
              </View>
              {sessionActionError ? (
                <TerminalText live="assertive" tone="red" uppercase={false} variant="caption">
                  {sessionActionError}
                </TerminalText>
              ) : null}
            </HUDBorderBox>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function SessionStatusCell({
  label,
  tone,
  value
}: {
  label: string;
  tone: 'cyan' | 'green' | 'amber';
  value: string;
}) {
  return (
    <View style={styles.statusCell}>
      <TerminalText tone="dim" variant="micro">
        {label}
      </TerminalText>
      <TerminalText glow tone={tone} variant="label">
        {value}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: 26,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  workoutFlowProgress: {
    marginBottom: spacing.md
  },
  sessionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: spacing.xs
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal,
    textAlign: 'right'
  },
  livePanel: {
    marginBottom: spacing.sm,
    padding: 18
  },
  liveMetrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 112
  },
  timerMetric: {
    flex: 1.08,
    minWidth: 0,
    justifyContent: 'center'
  },
  clock: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.timer,
    lineHeight: 48
  },
  minimumLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  metricDivider: {
    width: 1,
    marginHorizontal: spacing.md,
    backgroundColor: colors.borderCyanSoft
  },
  heartRateMetric: {
    flex: 0.92,
    minWidth: 0,
    justifyContent: 'center'
  },
  heartRateValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginVertical: spacing.xs
  },
  heartRateValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.display,
    lineHeight: 50
  },
  bpmLabel: {
    fontFamily: fontFamilies.terminal
  },
  progressSection: {
    width: '100%',
    marginTop: 18
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7
  },
  telemetryNotice: {
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  telemetryNoticeCopy: {
    fontFamily: fontFamilies.body
  },
  verificationPanel: {
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: 16
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCyanHairline
  },
  verificationHeadingCopy: {
    flex: 1,
    minWidth: 0
  },
  verificationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  statusCell: {
    width: '48%',
    minWidth: 0,
    minHeight: 66,
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.whiteAlpha05
  },
  saveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm
  },
  confirmCard: {
    padding: spacing.lg
  },
  confirmCopy: {
    marginBottom: 10,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10
  },
  confirmButton: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm
  },
  backButton: {
    minHeight: 44,
    marginTop: 10,
    paddingVertical: 11
  },
  alertHelp: {
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  sessionOptionsButton: {
    minHeight: 44,
    marginTop: spacing.md,
    paddingVertical: 11
  },
  sessionOptionsPanel: {
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.blackAlpha80
  },
  modalDialog: {
    width: '100%',
    maxWidth: 460
  }
});
