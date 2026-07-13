import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SessionUnavailable } from '@/components/session';
import { sessionTimeScale } from '@/config/runtime';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { useAppData } from '@/data/appDataHooks';
import { getSessionElapsedSeconds, workoutRules } from '@/domain/workoutProgress';
import { formatDateKey, useWorkoutProgress } from '@/state/workoutProgress';

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { mode: appDataMode, source: appDataSource } = useAppData();
  const {
    activeSession,
    cancelActiveWorkout,
    recordHeartRateSample,
    triggerMidSessionCheck
  } = useWorkoutProgress();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const activeSessionStartedAt = activeSession?.startedAt;

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
          workoutRules.minimumSessionSeconds
        )
      );
    };

    updateElapsedTime();
    const timer = setInterval(() => {
      updateElapsedTime();
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSessionStartedAt]);

  const session = useMemo(() => {
    const telemetry = appDataSource.getSessionTelemetry(elapsedSeconds);
    const progressPercent = Math.min(
      100,
      Math.round((elapsedSeconds / workoutRules.minimumSessionSeconds) * 100)
    );
    const minimumReached = elapsedSeconds >= workoutRules.minimumSessionSeconds;
    const midSessionVerified = activeSession?.midSessionVerified ?? false;
    const currentHeartRateElevated = Boolean(
      telemetry && telemetry.heartRate >= workoutRules.minimumAverageHeartRateBpm
    );
    const heartRateReady = activeSession?.verificationMethod !== 'heartRate' || Boolean(
      activeSession &&
        activeSession.heartRateObservedSeconds >= workoutRules.minimumSessionSeconds &&
        activeSession.averageHeartRateBpm >= workoutRules.minimumAverageHeartRateBpm
    );

    return {
      averageHeartRate: activeSession?.averageHeartRateBpm ?? 0,
      clock: formatClock(elapsedSeconds),
      finishCta:
        minimumReached && midSessionVerified && heartRateReady
          ? 'FINISH & CHECK OUT ->'
          : minimumReached
            ? !midSessionVerified
              ? 'MID-SESSION FACE CHECK REQUIRED'
              : `AVERAGE MUST REACH ${workoutRules.minimumAverageHeartRateBpm} BPM`
            : 'FINISH UNLOCKS AT 30:00',
      heartRate: telemetry?.heartRate ?? 0,
      currentHeartRateElevated,
      telemetryAvailable: telemetry !== null,
      heartRateReady,
      progressPercent,
      ready: minimumReached && midSessionVerified && heartRateReady
    };
  }, [activeSession, appDataSource, elapsedSeconds]);

  useEffect(() => {
    if (
      activeSession?.verificationMethod === 'heartRate' &&
      session.telemetryAvailable &&
      elapsedSeconds > 0
    ) {
      recordHeartRateSample(session.heartRate, elapsedSeconds);
    }
  }, [activeSession?.verificationMethod, elapsedSeconds, recordHeartRateSample, session.heartRate, session.telemetryAvailable]);

  useEffect(() => {
    if (
      activeSession &&
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
    return (
      <SessionUnavailable
        body="START FROM THE SESSION TAB SO CHECK-IN, TIMER AND CHECKPOINTS CAN BE TRACKED TOGETHER."
        onAction={() => router.replace('/session' as Href)}
      />
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <HUDBorderBox style={styles.recordingPill} tone="cyan">
          <View style={styles.recordingDot} />
          <TerminalText glow tone="cyan" variant="micro">
            SESSION TRACKING
          </TerminalText>
        </HUDBorderBox>
        <TerminalText style={styles.headerLabel} tone="muted" variant="label">
          SESSION ACTIVE
        </TerminalText>
      </View>

      <View style={styles.centerContent}>
        <TerminalText tone="dim" variant="label">
          ELAPSED
        </TerminalText>
        <TerminalText glow style={styles.clock} tone="cyan" variant="display">
          {session.clock}
        </TerminalText>
        <TerminalText style={styles.minimumLabel} tone="muted" variant="label">
          OF 30:00 MINIMUM
        </TerminalText>

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.progressLabels}>
            <TerminalText tone="dim" variant="micro">
              START
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              MID-PING
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              END
            </TerminalText>
          </View>
        </View>

        <View style={styles.metricRow}>
          {activeSession.verificationMethod === 'heartRate' ? (
            <>
              <HUDBorderBox style={styles.metricCard} tone={session.currentHeartRateElevated ? 'green' : 'amber'}>
                <TerminalText glow tone={session.currentHeartRateElevated ? 'green' : 'amber'} variant="label">
                  CURRENT BPM
                </TerminalText>
                <TerminalText style={styles.metricValue} tone="text" variant="value">
                  {session.telemetryAvailable ? session.heartRate : '--'}
                </TerminalText>
                <TerminalText tone={session.currentHeartRateElevated ? 'green' : 'amber'} variant="micro">
                  {session.currentHeartRateElevated ? 'ABOVE TARGET' : 'BELOW TARGET'}
                </TerminalText>
              </HUDBorderBox>

              <HUDBorderBox style={styles.metricCard} tone={session.heartRateReady ? 'green' : 'cyan'}>
                <TerminalText glow tone={session.heartRateReady ? 'green' : 'cyan'} variant="label">
                  30-MIN AVG
                </TerminalText>
                <TerminalText style={styles.metricValue} tone="text" variant="value">
                  {session.averageHeartRate}
                </TerminalText>
                <TerminalText tone={session.heartRateReady ? 'green' : 'cyan'} variant="micro">
                  {workoutRules.minimumAverageHeartRateBpm}+ REQUIRED
                </TerminalText>
              </HUDBorderBox>
            </>
          ) : (
            <>
              <HUDBorderBox style={styles.metricCard} tone="green">
                <TerminalText glow tone="green" variant="label">
                  ENTRY QR
                </TerminalText>
                <TerminalText style={styles.metricValue} tone="text" variant="value">
                  OK
                </TerminalText>
                <TerminalText tone="green" variant="micro">
                  CHECKED IN
                </TerminalText>
              </HUDBorderBox>
              <HUDBorderBox style={styles.metricCard} tone="cyan">
                <TerminalText glow tone="cyan" variant="label">
                  EXIT QR
                </TerminalText>
                <TerminalText style={styles.metricValue} tone="text" variant="value">
                  END
                </TerminalText>
                <TerminalText tone="cyan" variant="micro">
                  SCAN AT CHECKOUT
                </TerminalText>
              </HUDBorderBox>
            </>
          )}
        </View>
      </View>

      {activeSession.verificationMethod === 'heartRate' && !session.telemetryAvailable ? (
        <HUDBorderBox style={styles.telemetryNotice} tone="amber">
          <TerminalText glow tone="amber" variant="label">
            LIVE HEART-RATE SOURCE NOT CONNECTED
          </TerminalText>
          <TerminalText style={styles.telemetryNoticeCopy} tone="muted" uppercase={false} variant="body">
            Connected device telemetry is required before this session can be verified.
          </TerminalText>
        </HUDBorderBox>
      ) : appDataMode === 'demo' ? (
        <TerminalText style={styles.demoNotice} tone="amber" variant="micro">
          DEMO TELEMETRY // NOT A LIVE DEVICE READING
        </TerminalText>
      ) : null}

      <View style={styles.statusList}>
        <SessionStatusRow
          label="EFFORT"
          tone={activeSession.verificationMethod === 'heartRate'
            ? session.currentHeartRateElevated ? 'green' : 'amber'
            : 'green'}
          value={activeSession.verificationMethod === 'heartRate'
            ? session.currentHeartRateElevated ? 'HEART RATE ON TRACK' : 'RAISE YOUR HEART RATE'
            : 'PARTNER GYM CHECK-IN ACTIVE'}
        />
        <SessionStatusRow
          label="FACE CHECK"
          tone={activeSession.midSessionVerified
            ? 'green'
            : activeSession.midSessionCheckPrompted ? 'amber' : 'cyan'}
          value={activeSession.midSessionVerified
            ? 'VERIFIED'
            : activeSession.midSessionCheckPrompted ? 'ACTION REQUIRED' : 'WILL APPEAR AUTOMATICALLY'}
        />
        <SessionStatusRow
          label="SESSION SAVE"
          tone="cyan"
          value={`AUTO-SAVED // ${formatDateKey(activeSession.dateKey).toUpperCase()}`}
        />
      </View>

      <CyberButtonPrimary
        disabled={!session.ready}
        label={session.finishCta}
        onPress={() => router.push('/workout/check-out')}
        tone={session.ready ? 'green' : 'cyan'}
      />

      <View style={styles.actionRow}>
        {activeSession.midSessionCheckPrompted && !activeSession.midSessionVerified ? (
          <CyberButtonOutline
            label="COMPLETE FACE CHECK"
            onPress={() => router.push('/workout/ping')}
            style={styles.actionButton}
            tone="amber"
          />
        ) : null}

        <CyberButtonOutline
          label="END SESSION"
          onPress={() => setShowCancelConfirm(true)}
          style={styles.actionButton}
          tone="red"
        />
      </View>

      {showCancelConfirm ? (
        <HUDBorderBox glow style={styles.confirmCard} tone="red">
          <TerminalText style={styles.confirmCopy} tone="red" variant="body">
            END THIS SESSION? PROGRESS FROM THIS WORKOUT WILL NOT COUNT.
          </TerminalText>
          <View style={styles.confirmRow}>
            <CyberButtonOutline
              label="KEEP GOING"
              onPress={() => setShowCancelConfirm(false)}
              style={styles.confirmButton}
            />

            <CyberButtonOutline
              label="END NOW"
              onPress={() => {
                cancelActiveWorkout();
                router.replace('/home');
              }}
              style={styles.confirmButton}
              tone="red"
            />
          </View>
        </HUDBorderBox>
      ) : null}

      <CyberButtonOutline
        label="LEAVE SCREEN // SESSION CONTINUES"
        onPress={() => {
          router.replace('/home');
        }}
        style={styles.backButton}
      />
    </ScreenContainer>
  );
}

function SessionStatusRow({
  label,
  tone,
  value
}: {
  label: string;
  tone: 'cyan' | 'green' | 'amber';
  value: string;
}) {
  return (
    <HUDBorderBox style={styles.statusRow} tone={tone}>
      <TerminalText tone="dim" variant="micro">
        {label}
      </TerminalText>
      <TerminalText glow tone={tone} variant="label">
        {value}
      </TerminalText>
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    marginBottom: 18
  },
  recordingPill: {
    width: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.sm
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clock: {
    marginTop: 6,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.heroTimer,
    lineHeight: 68
  },
  minimumLabel: {
    marginTop: 6,
    fontFamily: fontFamilies.terminal
  },
  progressSection: {
    width: '100%',
    marginVertical: 26
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
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%'
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    padding: 18
  },
  metricValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  telemetryNotice: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  telemetryNoticeCopy: {
    fontFamily: fontFamilies.body
  },
  demoNotice: {
    marginBottom: spacing.sm,
    textAlign: 'center'
  },
  statusList: {
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  statusRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
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
    marginTop: 10,
    padding: spacing.md
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
  }
});
