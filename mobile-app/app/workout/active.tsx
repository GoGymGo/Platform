import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

const minimumSeconds = 1800;

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((currentSeconds) =>
        Math.min(currentSeconds + 23, minimumSeconds)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const session = useMemo(() => {
    const progressPercent = Math.min(
      100,
      Math.round((elapsedSeconds / minimumSeconds) * 100)
    );
    const heartRate = 132 + Math.round(7 * Math.sin(elapsedSeconds / 4));
    const elevatedMinutes = Math.min(20, Math.floor(elapsedSeconds / 60));

    return {
      clock: formatClock(elapsedSeconds),
      elevatedMinutes,
      finishCta:
        elapsedSeconds >= minimumSeconds
          ? 'FINISH & CHECK OUT ->'
          : 'FINISH UNLOCKS AT 30:00',
      heartRate,
      progressPercent,
      ready: elapsedSeconds >= minimumSeconds
    };
  }, [elapsedSeconds]);

  const progressWidth = `${session.progressPercent}%` as `${number}%`;

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <HUDBorderBox style={styles.recordingPill} tone="pink">
          <View style={styles.recordingDot} />
          <TerminalText glow tone="pink" variant="micro">
            RECORDING
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
          <HUDBorderBox style={styles.metricCard} tone="pink">
            <TerminalText glow tone="pink" variant="label">
              HEART
            </TerminalText>
            <TerminalText style={styles.metricValue} tone="text" variant="value">
              {session.heartRate}
            </TerminalText>
            <TerminalText tone="pink" variant="micro">
              BPM ELEVATED
            </TerminalText>
          </HUDBorderBox>

          <HUDBorderBox style={styles.metricCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              MIN
            </TerminalText>
            <TerminalText style={styles.metricValue} tone="text" variant="value">
              {session.elevatedMinutes}
            </TerminalText>
            <TerminalText tone="cyan" variant="micro">
              MIN ELEVATED / 20
            </TerminalText>
          </HUDBorderBox>
        </View>
      </View>

      <TerminalText style={styles.notice} tone="dim" variant="micro">
        A RANDOM PRESENCE CHECK MAY APPEAR BETWEEN MIN 8-24
      </TerminalText>

      <CyberButtonPrimary
        disabled={!session.ready}
        label={session.finishCta}
        onPress={() => router.push('/workout/check-out')}
      />

      <View style={styles.actionRow}>
        <CyberButtonOutline
          label="MID-SESSION CHECK"
          onPress={() => router.push('/workout/ping')}
          style={styles.actionButton}
        />

        <CyberButtonOutline
          label="END SESSION"
          onPress={() => setShowCancelConfirm(true)}
          style={styles.actionButton}
          tone="cyan"
        />
      </View>

      {showCancelConfirm ? (
        <HUDBorderBox glow style={styles.confirmCard} tone="pink">
          <TerminalText style={styles.confirmCopy} tone="pink" variant="body">
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
              onPress={() => router.push('/home')}
              style={styles.confirmButton}
              tone="pink"
            />
          </View>
        </HUDBorderBox>
      ) : null}

      <CyberButtonOutline
        label="BACK"
        onPress={() => router.push('/workout/check-in')}
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
    backgroundColor: colors.pink,
    ...cyberGlow.pink
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
  notice: {
    marginBottom: 14,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
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
    fontFamily: fontFamilies.terminal,
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
