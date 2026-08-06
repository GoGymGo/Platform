import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import { isCompetitionBonusDay } from '@/domain/competition';
import { shouldShowCreatorInvite } from '@/state/onboardingPreferences';
import { useAuth } from '@/state/auth';
import {
  type CompleteWorkoutResult,
  useWorkoutProgress
} from '@/state/workoutProgress';

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    activeSession,
    completeActiveWorkout,
    competition,
    currentStreak,
    currentWeekIndex,
    currentWeekVerified,
    sessionActionError,
    totalEntries,
    verifiedSessionCount,
    weeklyGoal
  } = useWorkoutProgress();
  const didCompleteSession = useRef(false);
  const [hadActiveSession] = useState(() => activeSession !== null);
  const [completedDateKey] = useState(() => activeSession?.dateKey ?? null);
  const [minimumSessionSeconds] = useState(
    () => activeSession?.minimumSessionSeconds ?? null
  );
  const [wasFirstVerifiedWorkout] = useState(() => verifiedSessionCount === 0);
  const [completionResult, setCompletionResult] = useState<
    CompleteWorkoutResult | 'pending' | 'submission-failed'
  >('pending');

  const submitCompletion = useCallback(async () => {
    setCompletionResult('pending');
    try {
      setCompletionResult(await completeActiveWorkout());
    } catch {
      setCompletionResult('submission-failed');
    }
  }, [completeActiveWorkout]);

  useEffect(() => {
    if (hadActiveSession && !didCompleteSession.current) {
      didCompleteSession.current = true;
      void submitCompletion();
    }
  }, [hadActiveSession, submitCompletion]);

  const progressSlots = useMemo(
    () =>
      Array.from({ length: weeklyGoal }, (_, index) => index < currentWeekVerified),
    [currentWeekVerified, weeklyGoal]
  );
  const remainingSessions = Math.max(weeklyGoal - currentWeekVerified, 0);
  const completedOnBonusDay = completedDateKey
    ? isCompetitionBonusDay(completedDateKey)
    : false;
  const entriesAwarded =
    completionResult === 'completed' && completedOnBonusDay ? weeklyGoal : 0;
  const competitionNotStarted = competition.phase === 'before-month';

  const continueFromCompletion = async () => {
    if (
      completionResult === 'completed' &&
      wasFirstVerifiedWorkout &&
      user &&
      await shouldShowCreatorInvite(user.uid)
    ) {
      router.replace('/creator/apply?source=first-workout' as Href);
      return;
    }

    router.replace('/home');
  };

  if (!hadActiveSession) {
    return (
      <SessionUnavailable
        actionLabel="START A WORKOUT"
        body="A session must pass the server-set timer and evidence requirements before competition credit can be awarded."
        onAction={() => router.replace('/session' as Href)}
        title="WORKOUT NOT STARTED"
      />
    );
  }

  if (
    completionResult === 'minimum-not-met' ||
    completionResult === 'heart-rate-evidence-not-met' ||
    completionResult === 'missing-mid-session-check' ||
    completionResult === 'no-active-session'
  ) {
    return (
      <SessionUnavailable
        actionLabel="RETURN TO WORKOUT"
        body={
          completionResult === 'heart-rate-evidence-not-met'
            ? 'The required heart-rate evidence has not finished uploading. Return to the workout and try again.'
            : `The session could not be completed because the ${minimumSessionSeconds ? formatClock(minimumSessionSeconds) : 'server-set'} timer or a required presence check did not pass.`
        }
        onAction={() => router.replace('/session' as Href)}
        title="ACTION NEEDED"
      />
    );
  }

  if (completionResult === 'submission-failed') {
    return (
      <SessionUnavailable
        actionLabel="TRY AGAIN"
        body={sessionActionError ?? 'Your workout remains open on this device. Check your connection and submit it again.'}
        onAction={() => void submitCompletion()}
        title="ACTION NEEDED"
      />
    );
  }

  if (completionResult === 'pending-review') {
    return (
      <SessionUnavailable
        actionLabel="GO TO HOME"
        body="Your workout and evidence were submitted successfully. Competition credit and entries will appear only after server review approves the session."
        onAction={() => router.replace('/home')}
        title="IN REVIEW"
      />
    );
  }

  if (completionResult === 'rejected') {
    return (
      <SessionUnavailable
        actionLabel="GO TO HOME"
        body="The submitted workout did not meet the competition's server-side duration or evidence requirements, so no credit or entries were awarded."
        onAction={() => router.replace('/home')}
        title="NOT ELIGIBLE"
      />
    );
  }

  if (completionResult === 'pending') {
    return (
      <ScreenContainer contentStyle={styles.pendingScreen}>
        <TerminalText glow tone="cyan" variant="label">
          SUBMITTING WORKOUT
        </TerminalText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <WorkoutFlowProgress
          complete
          stage="complete"
          style={styles.workoutProgress}
        />
        <HUDBorderBox glow style={styles.badge} tone={entriesAwarded > 0 ? 'pink' : 'green'}>
          <TerminalText glow style={styles.badgeText} tone={entriesAwarded > 0 ? 'pink' : 'green'} variant="display">
            {entriesAwarded > 0 ? `+${entriesAwarded}` : 'OK'}
          </TerminalText>
        </HUDBorderBox>

        <TerminalText glow style={styles.eyebrow} tone="green" variant="label">
          COMPLETE
        </TerminalText>
        <TerminalText style={styles.title} tone="text" variant="title">
          {completionResult === 'completed'
            ? entriesAwarded > 0
              ? `+${entriesAwarded} BONUS DAY PRIZE DRAW ${entriesAwarded === 1 ? 'ENTRY' : 'ENTRIES'}`
              : competitionNotStarted
                ? 'PERSONAL WORKOUT VERIFIED'
                : 'WORKOUT CREDIT SECURED'
            : 'SESSION ALREADY LOGGED TODAY'}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          {completionResult === 'completed'
            ? entriesAwarded > 0
              ? `Today is a Bonus Day. This verified workout adds ${entriesAwarded} Prize Draw ${entriesAwarded === 1 ? 'Entry' : 'Entries'}, equal to your Weekly Goal.`
              : competitionNotStarted
                ? 'Today is checked off in your Workout Calendar. Competition scoring has not opened yet, so this session does not add competition credit.'
                : 'Today is checked off. This verified workout counts toward your current scoring week; entries settle when the week closes.'
            : 'Today remains checked off, but a second verified session on the same day does not create another verified day or entry award.'}
        </TerminalText>

        <HUDBorderBox style={styles.progressCard} tone="cyan">
          <View style={styles.progressHeader}>
            <TerminalText tone="muted" variant="label">
              {competition.phase === 'bonus-days'
                ? 'BONUS DAYS 29-31'
                : competitionNotStarted
                  ? 'PRE-COMP VERIFIED'
                : `WEEK ${currentWeekIndex ?? 1} PROGRESS`}
            </TerminalText>
            <TerminalText tone="cyan" variant="label">
              {currentWeekVerified} OF {weeklyGoal} {weeklyGoal === 1 ? 'DAY' : 'DAYS'}
            </TerminalText>
          </View>
          <View style={styles.progressBars}>
            {progressSlots.map((isComplete, index) => (
              <View
                key={`slot-${index + 1}`}
                style={[styles.progressBar, isComplete ? styles.progressBarDone : styles.progressBarOpen]}
              />
            ))}
          </View>
          <TerminalText style={styles.progressNote} tone="dim" uppercase={false} variant="caption">
            {competition.phase === 'bonus-days'
              ? `Each verified Bonus Day workout adds ${weeklyGoal} ${weeklyGoal === 1 ? 'Entry' : 'Entries'} before a Perfect Month 10x.`
              : competitionNotStarted
                ? 'This session builds your personal workout history only. Competition credit begins when scoring opens.'
              : remainingSessions > 0
                ? `Complete ${remainingSessions} more verified ${remainingSessions === 1 ? 'session' : 'sessions'} to hit this week's goal.`
                : 'Weekly Goal hit. Your Weekly Challenge multiplier is ready to settle.'}
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.statsRow}>
          <HUDBorderBox style={styles.statCard} tone="cyan">
            <TerminalText style={styles.statValue} tone="cyan" variant="body">
              {currentStreak}
            </TerminalText>
            <TerminalText style={styles.statLabel} tone="muted" variant="micro">
              PERSONAL STREAK
            </TerminalText>
          </HUDBorderBox>
          <HUDBorderBox style={styles.statCard} tone="cyan">
            <TerminalText style={styles.statValue} tone="cyan" variant="body">
              {totalEntries}
            </TerminalText>
            <TerminalText style={styles.statLabel} tone="muted" variant="micro">
              PRIZE DRAW ENTRIES
            </TerminalText>
          </HUDBorderBox>
        </View>

        <CyberButtonPrimary
          label={completionResult === 'completed' && wasFirstVerifiedWorkout
            ? 'Continue'
            : 'Go to Home'}
          onPress={continueFromCompletion}
        />

      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pendingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenX,
    backgroundColor: colors.transparent
  },
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.transparent
  },
  workoutProgress: {
    marginBottom: spacing.xl
  },
  badge: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 65,
    marginBottom: 10,
    ...cyberGlow.cyan
  },
  badgeText: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displaySmall,
    lineHeight: 42
  },
  eyebrow: {
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  title: {
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 300,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  progressCard: {
    width: '100%',
    marginBottom: spacing.xxl,
    padding: spacing.lg
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  progressBars: {
    flexDirection: 'row',
    gap: 6
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4
  },
  progressBarDone: {
    backgroundColor: colors.cyan
  },
  progressBarOpen: {
    backgroundColor: colors.whiteAlpha08
  },
  progressNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: spacing.xl
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md
  },
  statValue: {
    fontFamily: fontFamilies.display
  },
  statLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  }
});
