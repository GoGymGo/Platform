import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';

const minimumSeconds = 30 * 60;

type DemoSessionState = 'idle' | 'active' | 'verified';

export default function DemoScreen() {
  const router = useRouter();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionState, setSessionState] = useState<DemoSessionState>('idle');
  const [status, setStatus] = useState(
    'Tap the simulated gym QR to start a sample session.'
  );

  useEffect(() => {
    if (sessionState !== 'active' || elapsedSeconds >= minimumSeconds) {
      return undefined;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((current) => Math.min(minimumSeconds, current + 60));
    }, 1_000);
    return () => clearInterval(timer);
  }, [elapsedSeconds, sessionState]);

  const remainingSeconds = Math.max(0, minimumSeconds - elapsedSeconds);
  const clock = useMemo(() => formatClock(elapsedSeconds), [elapsedSeconds]);

  function simulateScan() {
    if (sessionState === 'idle') {
      setElapsedSeconds(0);
      setSessionState('active');
      setStatus(
        'Entry accepted at Harbour View Condo Gym. The authoritative sample timer has started.'
      );
      return;
    }
    if (sessionState === 'active' && remainingSeconds > 0) {
      setStatus(
        `Too early to finish. ${formatDuration(remainingSeconds)} remains in the 30-minute minimum.`
      );
      return;
    }
    if (sessionState === 'active') {
      setSessionState('verified');
      setStatus('Exit accepted. This sample workout day is verified.');
    }
  }

  function resetDemo() {
    setElapsedSeconds(0);
    setSessionState('idle');
    setStatus('Tap the simulated gym QR to start a sample session.');
  }

  return (
    <ScreenContainer>
      <View accessibilityRole="header" style={styles.demoBanner}>
        <TerminalText glow tone="pink" variant="label">
          DEMO // SAMPLE DATA // NO ACCOUNT OR BACKEND
        </TerminalText>
      </View>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            VANCOUVER ISLAND PILOT
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            TRY GOGYMGO
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Explore the real member-app styling with isolated sample data. This
            demo never opens your camera, reads location, creates an account or
            writes to GoGymGo services.
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.regionCard} tone="green">
          <TerminalText tone="green" variant="label">
            SAMPLE REGION
          </TerminalText>
          <TerminalText glow tone="cyan" variant="title">
            VANCOUVER ISLAND + GULF ISLANDS
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            September 1–October 1, 2026 // Weekly Goal: 3 days // Reward: one
            $50 CAD cash prize sponsored by GoGymGo.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox glow style={styles.sessionCard} tone="cyan">
          <View style={styles.sessionHeader}>
            <View style={styles.sessionCopy}>
              <TerminalText tone="cyan" variant="label">
                HARBOUR VIEW CONDO GYM
              </TerminalText>
              <TerminalText tone="dim" uppercase={false} variant="caption">
                Simulated static QR // no camera or location
              </TerminalText>
            </View>
            <TerminalText
              glow
              tone={sessionState === 'verified' ? 'green' : 'pink'}
              variant="label"
            >
              {sessionState.toUpperCase()}
            </TerminalText>
          </View>

          <View style={styles.timerPanel}>
            <TerminalText tone="dim" variant="micro">
              SAMPLE SERVER TIMER
            </TerminalText>
            <TerminalText glow style={styles.clock} tone="cyan" variant="display">
              {clock}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              Accelerated for this demo: one real second equals one sample minute.
            </TerminalText>
          </View>

          <TerminalText
            live="polite"
            tone={sessionState === 'verified' ? 'green' : 'muted'}
            uppercase={false}
            variant="body"
          >
            {status}
          </TerminalText>

          {sessionState !== 'verified' ? (
            <CyberButtonPrimary
              label={sessionState === 'idle' ? 'SIMULATE QR ENTRY ->' : 'SIMULATE QR EXIT ->'}
              onPress={simulateScan}
            />
          ) : (
            <CyberButtonOutline label="RESET SAMPLE SESSION" onPress={resetDemo} />
          )}
        </HUDBorderBox>

        <CyberButtonPrimary
          label="JOIN THE REAL PILOT ->"
          onPress={() => router.replace('/join')}
          tone="pink"
        />
        <CyberButtonOutline
          label="BACK TO START"
          onPress={() => router.replace('/')}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.ceil(totalSeconds / 60);
  return `${minutes} sample ${minutes === 1 ? 'minute' : 'minutes'}`;
}

const styles = StyleSheet.create({
  demoBanner: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPinkHeavy,
    backgroundColor: colors.surfacePinkSoft
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    textAlign: 'center'
  },
  body: {
    maxWidth: 430,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  regionCard: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  sessionCard: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  sessionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  timerPanel: {
    alignItems: 'center',
    gap: spacing.xs
  },
  clock: {
    fontFamily: fontFamilies.display,
    fontSize: 48
  }
});
