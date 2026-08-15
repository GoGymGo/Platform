import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenLoadingState,
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { ProfileAvatar } from '@/components/profileAvatar';
import { CompactTextButton } from '@/components/onboarding';
import {
  RecoverableError,
  useAccessibilityAnnouncement
} from '@/components/reliability';
import { StreakRewards, UserAlias } from '@/components/streakRewards';
import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import {
  useCompetitionEnrollmentCount,
  useCreatorWorkouts,
  useMyLatestCompetitionResults,
  useMyRewardAwards,
  useMyStreaks,
  useWeeklyChallengeRequests
} from '@/data/appDataHooks';
import {
  getAppResumeRequestStatus,
  getAppResumeTarget
} from '@/domain/appResume';
import { getPublicInitials } from '@/domain/profile';
import {
  getGymVerificationHomeState,
  isMobileWebGymVerificationDevice
} from '@/domain/mobileGymVerification';
import { formatCompetitionOpeningDateTime } from '@/domain/competition';
import {
  getWorkoutAccessMode,
  getWorkoutEntryLabel,
  getWorkoutEntryTarget
} from '@/domain/workoutAccess';
import {
  getWinnersCirclePresentationKey,
  shouldAutoPresentWinnersCircle
} from '@/domain/winnersCircle';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { useWorkoutVerificationPreference } from '@/hooks/useWorkoutVerificationPreference';
import { recordFlowMetric } from '@/services/flowMetrics';
import { getLastSeenWinnersCircle } from '@/services/winnersCircle';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useProfile } from '@/state/profile';
import { useWorkoutProgress } from '@/state/workoutProgress';

type HomeStat = {
  label: string;
  tone: 'cyan' | 'pink';
  value: string;
};

function formatCampaignDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(year, month - 1, day, 12));
}

export default function HomeScreen() {
  const router = useRouter();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();
  const { goalDays, registered, resume } = useLocalSearchParams<{
    goalDays?: string;
    registered?: string;
    resume?: string;
  }>();
  const { user } = useAuth();
  const { regionVerification } = useCompetitionRegion();
  const competitionRegionCode = regionVerification?.regionCode ?? '';
  const [showMore, setShowMore] = useScreenMemory('home:show-more', false);
  const [resumeRetrying, setResumeRetrying] = useState(false);
  const resumeHandledRef = useRef(false);
  const resumeStartedRef = useRef(false);
  const goalMetricRecordedRef = useRef(false);
  const { profileImageUri, profileReady, publicName } = useProfile();
  const publicInitials = getPublicInitials(publicName);
  const {
    activeSession,
    competition,
    competitionId,
    competitionRegion,
    competitionTimeZone,
    currentWeekIndex,
    currentWeekVerified,
    prizeDrawEligible,
    projectedEntries,
    progressReady,
    scoringStatus,
    totalEntries,
    verifiedSessionCount,
    weeklyGoal
  } = useWorkoutProgress();
  const {
    checking: registrationChecking,
    currentCompetition,
    error: registrationError,
    ready: registrationReady,
    retry: retryRegistration,
    retrying: registrationRetrying,
    setupActionLabel,
    setupMessage,
    setupRoute,
    setupStep
  } = useSessionRegistrationAccess();
  const {
    preference: verificationPreference,
    ready: verificationPreferenceReady,
    saved: verificationPreferenceSaved,
    workoutStartRoute
  } = useWorkoutVerificationPreference();
  const currentPeriod = competition.currentPeriod;
  const completedSessions = Math.min(currentWeekVerified, weeklyGoal);
  const remainingSessions = Math.max(weeklyGoal - completedSessions, 0);
  const weeklyGoalUnit = weeklyGoal === 1 ? 'DAY' : 'DAYS';
  const weeklyObjectiveLabel = `${weeklyGoal} ${weeklyGoalUnit} / WEEK`;
  const weeklyAchievementLabel = `${completedSessions} OF ${weeklyGoal} ${weeklyGoalUnit}`;
  const isBonusDayPhase = competition.phase === 'bonus-days';
  const competitionNotStarted = competition.phase === 'before-month';
  const competitionStartLabel = formatCampaignDate(`${competition.competitionMonthKey}-01`);
  const competitionOpeningDateTime = currentCompetition
    ? formatCompetitionOpeningDateTime(
        currentCompetition.startsAt,
        competitionTimeZone
      )
    : null;
  const [competitionYear, competitionMonth] = competition.competitionMonthKey
    .split("-")
    .map(Number);
  const competitionStartMonth = new Intl.DateTimeFormat("en-CA", {
    month: "long",
  }).format(new Date(competitionYear, competitionMonth - 1, 1, 12));
  const currentEntrantsQuery = useCompetitionEnrollmentCount(
    currentCompetition?.id ?? null,
    competitionRegionCode,
    competition.competitionMonthKey,
  );
  const { data: currentEntrantsData, isPending: currentEntrantsPending } =
    currentEntrantsQuery;
  const { data: creatorWorkouts = [] } = useCreatorWorkouts(
    competitionRegionCode
  );
  const rewardAwardsQuery = useMyRewardAwards();
  const { data: rewardAwards = [] } = rewardAwardsQuery;
  const latestResultsQuery = useMyLatestCompetitionResults();
  const latestCompetitionResults = latestResultsQuery.data ?? null;
  const [seenResultsState, setSeenResultsState] = useState<{
    key: string | null;
    userId: string;
  } | null>(null);
  const lastSeenResultsKey =
    user && seenResultsState?.userId === user.uid
      ? seenResultsState.key
      : undefined;
  const weeklyChallengeRequestsQuery = useWeeklyChallengeRequests(
    competitionId ?? '',
    competition.competitionMonthKey,
    weeklyGoal,
    competitionRegionCode,
    currentPeriod?.index ?? 1
  );
  const streaksQuery = useMyStreaks();
  const streakSummary = streaksQuery.data ?? null;
  const currentEntrants = currentEntrantsData ?? null;
  const unclaimedReward = rewardAwards.find((award) => award.status === 'awarded');
  const featuredCreatorWorkout = creatorWorkouts[0] ?? null;
  const completedContestWithoutReplacement = Boolean(
    latestCompetitionResults && !currentCompetition
  );
  const resultsPresentationKey = latestCompetitionResults
    ? getWinnersCirclePresentationKey(latestCompetitionResults)
    : null;
  const unseenCompetitionResults =
    lastSeenResultsKey !== undefined &&
    shouldAutoPresentWinnersCircle(resultsPresentationKey, lastSeenResultsKey);
  const minimumEntrants = currentCompetition?.minimumEntrants ?? null;
  const launchConfirmed =
    currentEntrants !== null &&
    minimumEntrants !== null &&
    currentEntrants >= minimumEntrants;
  const entrantsNeeded = currentEntrants === null || minimumEntrants === null
    ? null
    : Math.max(0, minimumEntrants - currentEntrants);
  const liveMultiplier = currentPeriod?.liveMultiplier ?? 0;
  const stats: readonly HomeStat[] = [
    {
      value: String(totalEntries),
      label: 'BANKED DRAW ENTRIES',
      tone: 'pink'
    },
    {
      value: `${completedSessions} OF ${weeklyGoal}`,
      label: competitionNotStarted ? 'VERIFIED BEFORE START' : 'ACHIEVED THIS WEEK',
      tone: 'cyan'
    },
    {
      value: currentPeriod
        ? `${Math.min(currentPeriod.opponentVerifiedCount, weeklyGoal)}/${weeklyGoal}`
        : 'NOT STARTED',
      label: currentPeriod ? 'PARTNER DAYS' : 'WEEKLY CHALLENGE',
      tone: 'cyan'
    }
  ];

  const workoutAccessMode = getWorkoutAccessMode(
    currentCompetition ? currentCompetition.status !== 'active' : competitionNotStarted
  );
  const workoutUnavailable = workoutAccessMode === 'upcoming';
  const workoutEntryTarget = getWorkoutEntryTarget({
    activeSession: activeSession !== null,
    registrationReady
  });
  const activeWorkoutRoute =
    activeSession?.verificationMethod === 'heartRate' && heartRateTelemetryAvailable
    ? '/workout/active'
    : '/qr-scanner';
  const setupRequired =
    workoutEntryTarget === 'setup' && !completedContestWithoutReplacement;
  const workoutEntryLabel = getWorkoutEntryLabel({
    activeSession: activeSession !== null,
    setupActionLabel,
    setupRequired,
    workoutUnavailable
  });
  const gymVerificationHome = getGymVerificationHomeState({
    mobileGymVerificationAvailable,
    resume,
    setupChecking: registrationChecking,
    setupError: registrationError,
    setupRequired
  });
  const desktopSetupChecking = gymVerificationHome.desktopSetupChecking;
  const desktopSetupError = gymVerificationHome.desktopSetupError;
  const desktopSetupPending = gymVerificationHome.desktopSetupPending;
  const effectiveSetupRequired = gymVerificationHome.setupRequired;
  const showGoalProgress =
    !completedContestWithoutReplacement &&
    !effectiveSetupRequired &&
    !desktopSetupChecking &&
    !desktopSetupError &&
    !desktopSetupPending;
  const registeredGoal = Number(goalDays);
  const successGoal = Number.isInteger(registeredGoal) && registeredGoal > 0
    ? registeredGoal
    : weeklyGoal;
  const setupEyebrow =
    setupStep === 'region'
      ? 'REGION REQUIRED'
      : setupStep === 'agreements'
        ? 'ACCOUNT AGREEMENTS'
        : 'WEEKLY GOAL';
  const setupTitle =
    setupStep === 'region'
      ? 'VERIFY YOUR REGION'
      : setupStep === 'agreements'
        ? 'REVIEW AGREEMENTS'
        : 'CHOOSE YOUR WEEKLY GOAL';
  const resumeRequested = gymVerificationHome.resumeRequested;
  const pendingChallengeInvite = (weeklyChallengeRequestsQuery.data ?? [])
    .some(({ direction }) => direction === 'incoming');
  const immediateResumeTarget = getAppResumeTarget({
    activeWorkout: mobileGymVerificationAvailable && activeSession !== null,
    activeWorkoutRoute,
    pendingChallengeInvite: false,
    setupRoute: mobileGymVerificationAvailable ? setupRoute ?? null : null,
    unseenCompetitionResults,
    unclaimedReward: false
  });
  const urgentResumeTarget =
    mobileGymVerificationAvailable && activeSession !== null
      ? immediateResumeTarget
      : null;
  const resultsDecisionLoading =
    latestResultsQuery.isLoading ||
    (latestCompetitionResults !== null && lastSeenResultsKey === undefined);
  const secondaryResumeLoading =
    !urgentResumeTarget &&
    (
      resultsDecisionLoading ||
      weeklyChallengeRequestsQuery.isLoading ||
      rewardAwardsQuery.isLoading
    );
  const secondaryResumeError =
    !urgentResumeTarget &&
    (
      latestResultsQuery.isError ||
      weeklyChallengeRequestsQuery.isError ||
      rewardAwardsQuery.isError
    );
  const {
    error: resumeError,
    loading: resumeLoading
  } = getAppResumeRequestStatus({
    hasImmediateTarget: urgentResumeTarget !== null,
    registrationError: registrationError || latestResultsQuery.isError,
    registrationLoading: registrationChecking,
    secondaryError: secondaryResumeError,
    secondaryLoading: secondaryResumeLoading
  });

  useAccessibilityAnnouncement(
    registered === '1'
      ? `Weekly Goal set to ${successGoal} ${successGoal === 1 ? 'day' : 'days'}.`
      : null
  );

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    void getLastSeenWinnersCircle(user.uid)
      .then((value) => {
        if (mounted) setSeenResultsState({ key: value, userId: user.uid });
      })
      .catch(() => {
        if (mounted) setSeenResultsState({ key: null, userId: user.uid });
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (registered !== '1' || goalMetricRecordedRef.current) {
      return;
    }
    goalMetricRecordedRef.current = true;
    void recordFlowMetric(user?.uid, 'weekly-goal-completed', 'weekly-goal');
  }, [registered, user?.uid]);

  useEffect(() => {
    if (!resumeRequested || resumeHandledRef.current) {
      return;
    }

    if (!resumeStartedRef.current) {
      resumeStartedRef.current = true;
      void recordFlowMetric(user?.uid, 'resume-started', 'home');
    }

    if (resumeLoading || resumeError) {
      return;
    }

    const target = getAppResumeTarget({
      activeWorkout: mobileGymVerificationAvailable && activeSession !== null,
      activeWorkoutRoute,
      pendingChallengeInvite,
      setupRoute:
        mobileGymVerificationAvailable && !completedContestWithoutReplacement
          ? setupRoute ?? null
          : null,
      unseenCompetitionResults,
      unclaimedReward: Boolean(unclaimedReward)
    });
    resumeHandledRef.current = true;
    void recordFlowMetric(user?.uid, 'resume-completed', 'home');
    if (target?.kind === 'active-workout') {
      void recordFlowMetric(user?.uid, 'workout-resumed', 'workout');
    }
    router.replace((target?.route ?? '/home') as Href);
  }, [
    activeSession,
    activeWorkoutRoute,
    completedContestWithoutReplacement,
    mobileGymVerificationAvailable,
    pendingChallengeInvite,
    resumeError,
    resumeLoading,
    resumeRequested,
    router,
    setupRoute,
    unseenCompetitionResults,
    unclaimedReward,
    user?.uid
  ]);

  const retryResume = async () => {
    setResumeRetrying(true);
    void recordFlowMetric(user?.uid, 'flow-retry', 'home');
    try {
      await Promise.all([
        retryRegistration(),
        latestResultsQuery.refetch(),
        weeklyChallengeRequestsQuery.refetch(),
        rewardAwardsQuery.refetch()
      ]);
    } finally {
      setResumeRetrying(false);
    }
  };

  if (
    !profileReady ||
    !progressReady ||
    latestResultsQuery.isLoading ||
    (mobileGymVerificationAvailable && registrationChecking) ||
    (mobileGymVerificationAvailable && !verificationPreferenceReady)
  ) {
    return <ScreenLoadingState body="Checking your Contest." />;
  }

  if (resumeRequested && resumeLoading) {
    return <ScreenLoadingState body="Finding your next step." />;
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey="home"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <TerminalText tone="cyan" variant="label">
              {effectiveSetupRequired
                ? 'SETUP INCOMPLETE'
                : desktopSetupChecking
                  ? 'ACCOUNT READY // SYNCING CONTEST STATUS'
                : desktopSetupError
                  ? 'ACCOUNT READY // CONTEST STATUS UNAVAILABLE'
                : desktopSetupPending
                  ? 'ACCOUNT READY // MOBILE CONTEST SETUP PENDING'
                : 'ACCOUNT READY // ' + competitionRegion}
            </TerminalText>
            <UserAlias
              accessibilityRole="text"
              alias={publicName}
              streaks={streakSummary?.streaks}
              textStyle={styles.username}
              tone="text"
              variant="title"
            />
          </View>
          <ProfileAvatar imageUri={profileImageUri} initials={publicInitials} showStatus size={46} />
        </View>

        {registered === '1' ? (
          <HUDBorderBox style={styles.registrationSuccess} tone="green">
            <View style={styles.registrationSuccessCopy}>
              <TerminalText tone="green" variant="label">
                WEEKLY GOAL SET // {successGoal} {successGoal === 1 ? 'DAY' : 'DAYS'}
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                You&apos;re ready. Your next action is shown below.
              </TerminalText>
            </View>
            <CompactTextButton
              label="DISMISS"
              onPress={() => router.replace('/home')}
              tone="muted"
            />
          </HUDBorderBox>
        ) : null}

        {resumeRequested && resumeError ? (
          <RecoverableError
            body="We couldn&apos;t check your Contest. Try again or continue to Home."
            continueLabel="Continue to Home"
            onContinue={() => {
              resumeHandledRef.current = true;
              router.replace('/home');
            }}
            onRetry={() => void retryResume()}
            retrying={resumeRetrying || registrationRetrying}
            style={styles.resumeError}
            title="COULD NOT RESUME"
          />
        ) : null}

        <HUDBorderBox
          style={styles.commitmentCard}
          tone={
            completedContestWithoutReplacement
              ? latestCompetitionResults?.resultsStatus === 'settled'
                ? 'pink'
                : 'amber'
              : effectiveSetupRequired
                ? 'amber'
                : 'cyan'
          }
        >
          <View style={styles.commitmentHeader}>
            <View style={styles.commitmentTitleBlock}>
              <TerminalText
                tone={effectiveSetupRequired ? 'amber' : 'cyan'}
                variant="label"
              >
                {completedContestWithoutReplacement
                  ? latestCompetitionResults?.resultsStatus === 'settled'
                    ? 'CONTEST COMPLETE'
                    : 'RESULTS IN PROGRESS'
                  : effectiveSetupRequired
                  ? setupEyebrow
                  : desktopSetupChecking
                    ? 'SYNCING CONTEST STATUS'
                  : desktopSetupError
                    ? 'CONTEST STATUS UNAVAILABLE'
                  : desktopSetupPending
                    ? 'CONTINUE ON MOBILE'
                  : isBonusDayPhase
                  ? 'BONUS DAYS 29-31'
                  : competitionNotStarted
                    ? 'UPCOMING CONTEST'
                    : `WEEK ${currentWeekIndex ?? 1} // ${completedSessions > 0 ? 'IN MOTION' : 'READY'}`}
              </TerminalText>
              <TerminalText style={styles.commitmentTitle} tone="text" uppercase variant="title">
                {completedContestWithoutReplacement
                  ? latestCompetitionResults?.resultsStatus === 'settled'
                    ? 'VIEW YOUR RESULTS'
                    : 'RESULTS ARE BEING FINALIZED'
                  : effectiveSetupRequired
                  ? setupTitle
                  : desktopSetupChecking
                    ? 'LOADING YOUR CONTEST'
                  : desktopSetupError
                    ? 'YOUR ACCOUNT IS STILL AVAILABLE'
                  : desktopSetupPending
                    ? 'FINISH CONTEST SETUP ON A PHONE OR TABLET'
                  : isBonusDayPhase
                  ? `ADD ${weeklyGoal} ${weeklyGoal === 1 ? 'ENTRY' : 'ENTRIES'} PER DAY`
                  : competitionNotStarted
                    ? 'YOUR WEEKLY GOAL IS SET'
                    : verifiedSessionCount > 0
                      ? 'KEEP BUILDING YOUR WEEK'
                      : 'START YOUR FIRST WORKOUT'}
              </TerminalText>
              <TerminalText style={styles.commitmentCopy} tone="muted" uppercase={false} variant="body">
                {completedContestWithoutReplacement
                  ? latestCompetitionResults?.resultsStatus === 'settled'
                    ? 'Your placement is ready in the Winners Circle.'
                    : 'Check back soon.'
                  : effectiveSetupRequired
                  ? setupMessage
                  : desktopSetupChecking
                    ? 'Loading your Contest.'
                  : desktopSetupError
                    ? 'Contest status could not refresh. Other screens are still available.'
                  : desktopSetupPending
                    ? 'Finish Contest setup on your phone or tablet.'
                  : !mobileGymVerificationAvailable
                    ? 'Track your Weekly Goal and entries here. Verify workouts on your phone.'
                  : isBonusDayPhase
                  ? `Verify one workout on each remaining day to add ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'} per day.`
                  : competitionNotStarted
                    ? 'Use a fresh gym location check when you start and finish each workout.'
                    : remainingSessions > 0
                      ? `Complete ${remainingSessions} more workout ${remainingSessions === 1 ? 'day' : 'days'} this week. One per day counts.`
                      : 'Weekly Goal hit. Check your Weekly Challenge bonus.'}
              </TerminalText>
              {showGoalProgress && competitionNotStarted ? (
                <TerminalText glow style={styles.scoringStartWarning} tone="amber" variant="body">
                  SCORING STARTS {competitionStartMonth.toUpperCase()} 1ST 12:00AM.
                </TerminalText>
              ) : null}
            </View>
            {!completedContestWithoutReplacement ? (
              <View style={styles.multiplierBlock}>
                <TerminalText glow style={styles.multiplier} tone="cyan" variant="value">
                  {effectiveSetupRequired || desktopSetupChecking || desktopSetupError || desktopSetupPending
                    ? '--'
                    : competitionNotStarted ? `${weeklyGoal}` : liveMultiplier === 0 ? '1X' : `${liveMultiplier}X`}
                </TerminalText>
                <TerminalText tone="muted" variant="micro">
                  {effectiveSetupRequired || desktopSetupChecking || desktopSetupError || desktopSetupPending
                    ? desktopSetupChecking
                      ? 'SYNCING'
                      : desktopSetupError
                        ? 'CHECK LATER'
                        : 'NEXT STEP'
                    : competitionNotStarted
                    ? 'DAY GOAL'
                     : liveMultiplier === 3
                      ? 'BONUS READY'
                      : liveMultiplier === 2
                        ? 'TEAM BONUS'
                        : 'BASE ENTRIES'}
                </TerminalText>
              </View>
            ) : null}
          </View>

          {showGoalProgress ? (
            <View
              accessible
              accessibilityLabel={
                isBonusDayPhase
                  ? `Weekly Goal objective: ${weeklyGoal} ${weeklyGoal === 1 ? 'day' : 'days'} per week. Weekly scoring is complete.`
                  : `Weekly Goal objective: ${weeklyGoal} ${weeklyGoal === 1 ? 'day' : 'days'} per week. Achieved: ${completedSessions} of ${weeklyGoal} ${weeklyGoal === 1 ? 'day' : 'days'} this week.`
              }
              style={styles.goalProgressSummary}
            >
              <View style={styles.goalProgressMetric}>
                <TerminalText tone="muted" variant="micro">
                  OBJECTIVE
                </TerminalText>
                <TerminalText glow style={styles.goalProgressValue} tone="cyan" variant="label">
                  {weeklyObjectiveLabel}
                </TerminalText>
              </View>
              <View style={styles.goalProgressDivider} />
              <View style={styles.goalProgressMetric}>
                <TerminalText tone="muted" variant="micro">
                  {isBonusDayPhase ? 'WEEKLY SCORING' : 'ACHIEVED THIS WEEK'}
                </TerminalText>
                <TerminalText
                  glow={!isBonusDayPhase && completedSessions >= weeklyGoal}
                  style={styles.goalProgressValue}
                  tone={!isBonusDayPhase && completedSessions >= weeklyGoal ? 'green' : 'text'}
                  variant="label"
                >
                  {isBonusDayPhase ? '4 WEEKS COMPLETE' : weeklyAchievementLabel}
                </TerminalText>
              </View>
            </View>
          ) : null}

          {showGoalProgress ? <View style={styles.weekDots}>
            {Array.from({ length: weeklyGoal }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.weekDot,
                  index < completedSessions ? styles.weekDotDone : styles.weekDotOpen
                ]}
              />
            ))}
          </View> : null}

          {completedContestWithoutReplacement ? (
            <CyberButtonPrimary
              label={
                latestCompetitionResults?.resultsStatus === 'settled'
                  ? 'VIEW RESULTS'
                  : 'CHECK RESULTS'
              }
              onPress={() => router.push('/winners-circle')}
              tone={
                latestCompetitionResults?.resultsStatus === 'settled'
                  ? 'pink'
                  : 'cyan'
              }
            />
          ) : gymVerificationHome.showWorkoutActions ? (
          <>
          <CyberButtonPrimary
            disabled={!setupRequired && workoutUnavailable && !activeSession}
            label={workoutEntryLabel}
            onPress={() => {
              if (workoutEntryTarget === 'setup' && setupRoute) {
                router.push(setupRoute as Href);
                return;
              }
              router.push(
                workoutEntryTarget === 'active-session'
                  ? activeWorkoutRoute
                  : workoutStartRoute
              );
            }}
          />
          {setupRequired ? (
            <TerminalText style={styles.previewWorkoutNote} tone="amber" uppercase={false} variant="caption">
              Complete this step before starting a Verified workout.
            </TerminalText>
          ) : !activeSession && competitionOpeningDateTime ? (
            <TerminalText style={styles.previewWorkoutNote} tone="amber" uppercase={false} variant="caption">
              {`Start your workout at ${competitionOpeningDateTime}.`}
            </TerminalText>
          ) : null}
          {!activeSession && !setupRequired ? (
            <TerminalText style={styles.defaultMethod} tone="muted" uppercase={false} variant="caption">
              {verificationPreferenceSaved
                ? `Pilot verification: ${verificationPreference.sourceLabel}.`
                : 'Check your location at the selected Partner gym to start a Verified workout.'}
            </TerminalText>
          ) : null}
          </>
          ) : null}

          {!effectiveSetupRequired && competitionNotStarted ? (
            <View style={styles.launchStatus}>
              <View style={styles.launchHeader}>
                <TerminalText tone="dim" variant="micro">
                  REGIONAL LAUNCH
                </TerminalText>
                <TerminalText
                  glow={launchConfirmed}
                  tone={launchConfirmed ? 'green' : currentEntrants === null ? 'dim' : 'amber'}
                  variant="label"
                >
                  {currentEntrantsPending
                    ? 'CHECKING REGISTRATION COUNT'
                    : currentEntrants === null
                      ? 'REGISTRATION TOTAL UNAVAILABLE'
                    : minimumEntrants === null
                      ? `${currentEntrants.toLocaleString()} REGISTERED`
                      : `${currentEntrants.toLocaleString()} / ${minimumEntrants.toLocaleString()} REGISTERED`}
                </TerminalText>
              </View>
              <TerminalText tone={launchConfirmed ? 'green' : 'muted'} uppercase={false} variant="caption">
                {launchConfirmed
                  ? 'Contest launch confirmed.'
                  : entrantsNeeded === null
                    ? 'The registration total could not be loaded. Check again later.'
                    : `${entrantsNeeded} more ${entrantsNeeded === 1 ? 'player is' : 'players are'} needed to launch.`}
              </TerminalText>
            </View>
          ) : null}
        </HUDBorderBox>

        {unclaimedReward ? (
          <Pressable
            accessibilityHint={
              unclaimedReward.rewardType === "cash"
                ? "Open My Awards to review the pending in-person cash handoff"
                : "Open My Awards to claim this Award"
            }
            accessibilityRole="button"
            onPress={() => router.push('/rewards/awards')}
            style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
          >
            <HUDBorderBox glow style={styles.rewardAlert} tone="pink">
              <View style={styles.rewardAlertCopy}>
                <TerminalText glow tone="pink" variant="label">
                  {unclaimedReward.rewardType === "cash"
                    ? "CASH AWARD // HANDOFF PENDING"
                    : `AWARD READY // ${unclaimedReward.title}`}
                </TerminalText>
                <TerminalText tone="text" uppercase={false} variant="body">
                  {unclaimedReward.rewardType === "cash"
                    ? "Open My Awards to review the settled result and manual handoff status."
                    : "Open My Awards to claim it."}
                </TerminalText>
              </View>
              <TerminalText glow tone="pink" variant="button">
                -&gt;
              </TerminalText>
            </HUDBorderBox>
          </Pressable>
        ) : null}

        <CyberButtonOutline
          label={showMore ? 'Hide Explore' : 'Explore GoGymGo'}
          onPress={() => setShowMore((current) => !current)}
          style={styles.moreButton}
        />

        {showMore ? (
          <View style={styles.secondaryContent}>
            <TerminalText glow tone="cyan" variant="label">
              EXPLORE
            </TerminalText>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/how-it-works?from=home')}
              style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
            >
              <HUDBorderBox style={styles.guideCard} tone="cyan">
                <View style={styles.guideCopy}>
                  <TerminalText tone="dim" variant="micro">
                    QUICK REFERENCE
                  </TerminalText>
                  <TerminalText tone="text" uppercase={false} variant="body">
                    How the Contest works
                  </TerminalText>
                  <TerminalText tone="muted" uppercase={false} variant="caption">
                    Goals, workouts, entries, rankings and Rewards.
                  </TerminalText>
                </View>
                <TerminalText tone="cyan" variant="button">
                  -&gt;
                </TerminalText>
              </HUDBorderBox>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/calendar' as Href)}
              style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
            >
              <HUDBorderBox style={styles.calendarCard} tone="cyan">
                <View style={styles.calendarCopy}>
                  <TerminalText glow tone="cyan" variant="micro">
                    WORKOUT CALENDAR
                  </TerminalText>
                  <TerminalText style={styles.calendarTitle} tone="text" uppercase={false} variant="body">
                    Review checked days and workout history
                  </TerminalText>
                </View>
                <TerminalText tone="cyan" variant="button">
                  -&gt;
                </TerminalText>
              </HUDBorderBox>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/squad')}
              style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
            >
              <HUDBorderBox style={styles.pactCard} tone="cyan">
                <View style={styles.pactAvatars}>
                  <View style={styles.pactAvatarYou}>
                    <TerminalText style={styles.pactAvatarTextDark} tone="dim" variant="button">
                      {publicInitials}
                    </TerminalText>
                  </View>
                  <View style={styles.pactAvatarMatch}>
                    <TerminalText tone="muted" variant="button">
                      {getPublicInitials(currentPeriod?.opponentAlias ?? 'PARTNER')}
                    </TerminalText>
                  </View>
                </View>
                <View style={styles.pactCopy}>
                  <TerminalText glow tone="cyan" variant="micro">
                    WEEKLY CHALLENGE
                  </TerminalText>
                  {isBonusDayPhase || competitionNotStarted || !currentPeriod ? (
                    <TerminalText style={styles.pactTitle} tone="text" uppercase={false} variant="body">
                      {isBonusDayPhase
                        ? `Bonus Days: +${weeklyGoal} ${weeklyGoal === 1 ? 'entry' : 'entries'} each`
                        : competitionNotStarted
                          ? `Challenges open ${competitionStartLabel}`
                          : 'Pairing in progress'}
                    </TerminalText>
                  ) : (
                    <View style={styles.pactOpponent}>
                      <UserAlias
                        alias={currentPeriod.opponentAlias}
                        streaks={currentPeriod.opponentStreaks}
                        textStyle={styles.pactTitle}
                        uppercase={false}
                      />
                      <TerminalText tone="cyan" variant="micro">
                        {currentPeriod.opponentVerifiedCount}/{weeklyGoal} THIS WEEK
                      </TerminalText>
                    </View>
                  )}
                </View>
                <TerminalText tone="cyan" variant="button">
                  -&gt;
                </TerminalText>
              </HUDBorderBox>
            </Pressable>

            <StreakRewards
              isError={streaksQuery.isError}
              isLoading={streaksQuery.isPending}
              onRetry={() => void streaksQuery.refetch()}
              retrying={streaksQuery.isFetching}
              summary={streakSummary}
            />

            <View style={styles.statsRow}>
              {stats.map((stat) => (
                <HUDBorderBox key={stat.label} style={styles.statCard} tone="muted">
                  <TerminalText glow style={styles.statValue} tone={stat.tone} variant="value">
                    {stat.value}
                  </TerminalText>
                  <TerminalText style={styles.statLabel} tone="muted" variant="micro">
                    {stat.label}
                  </TerminalText>
                </HUDBorderBox>
              ))}
            </View>
            <TerminalText style={styles.oddsNote} tone="muted" uppercase={false} variant="body">
              {prizeDrawEligible
                ? competitionNotStarted
                  ? 'Your free Prize Draw entry is secured. Workouts count when scoring opens.'
                  : scoringStatus === 'final'
                    ? `${totalEntries} final Prize Draw ${totalEntries === 1 ? 'Entry is' : 'Entries are'} locked to the audited Contest settlement.`
                    : `${totalEntries} ${totalEntries === 1 ? 'entry is' : 'entries are'} banked. ${projectedEntries} ${projectedEntries === 1 ? 'entry is' : 'entries are'} projected if current scoring settles; Bonus Days and Perfect Month remain provisional until finalization.`
                : 'Your free entry will carry into the next eligible regional draw.'}
            </TerminalText>

            {featuredCreatorWorkout ? <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/workouts/${featuredCreatorWorkout.id}`)}
              style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
            >
              <HUDBorderBox style={styles.workoutCard} tone="cyan">
                <View style={styles.videoPreview}>
                  <View style={styles.videoBadgeRow}>
                    <View style={styles.creatorBadge}>
                      <TerminalText glow tone="cyan" variant="micro">
                        CREATOR WORKOUT
                      </TerminalText>
                    </View>
                    <View style={styles.channelBadge}>
                      <TerminalText glow tone="cyan" variant="micro">
                        OFFICIAL CHANNEL
                      </TerminalText>
                    </View>
                  </View>
                  <View style={styles.playCircle}>
                    <TerminalText glow tone="cyan" variant="micro">
                      VIEW
                    </TerminalText>
                  </View>
                </View>
                <View style={styles.workoutCopy}>
                  <TerminalText style={styles.workoutTitle} tone="text" uppercase variant="body">
                    {featuredCreatorWorkout.name}
                  </TerminalText>
                  <TerminalText tone="muted" uppercase={false} variant="body">
                    Optional follow-along workout. Session verification still happens in GoGymGo.
                  </TerminalText>
                </View>
              </HUDBorderBox>
            </Pressable> : null}
          </View>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.transparent
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingLeft: 14,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md
  },
  username: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  pressableCard: {
    width: '100%'
  },
  videoAd: {
    marginBottom: spacing.lg,
  },
  registrationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  registrationSuccessCopy: {
    flex: 1,
    gap: spacing.xs
  },
  resumeError: {
    marginBottom: spacing.lg
  },
  commitmentCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  defaultMethod: {
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  moreButton: {
    marginTop: spacing.sm
  },
  secondaryContent: {
    gap: spacing.lg,
    marginTop: spacing.lg
  },
  streakRewards: {
    marginBottom: spacing.lg
  },
  rewardAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  rewardAlertCopy: {
    flex: 1,
    gap: spacing.xs
  },
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  commitmentTitleBlock: {
    flex: 1
  },
  commitmentTitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 25
  },
  commitmentCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body
  },
  previewWorkoutNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  launchStatus: {
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.whiteAlpha08
  },
  launchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  scoringStartWarning: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  multiplierBlock: {
    alignItems: 'flex-end'
  },
  multiplier: {
    fontFamily: fontFamilies.display
  },
  goalProgressSummary: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: radii.md,
    backgroundColor: colors.panelSoft
  },
  goalProgressMetric: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  goalProgressDivider: {
    width: 1,
    backgroundColor: colors.borderCyanQuiet
  },
  goalProgressValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 24
  },
  weekDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md
  },
  weekDot: {
    flex: 1,
    height: 8,
    borderRadius: 4
  },
  weekDotDone: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  weekDotOpen: {
    backgroundColor: colors.whiteAlpha08
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.sm
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: spacing.md
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 28
  },
  statLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  oddsNote: {
    marginBottom: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg
  },
  guideCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  calendarCopy: {
    flex: 1
  },
  calendarTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.bodyStrong
  },
  pactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  pactAvatars: {
    flexDirection: 'row'
  },
  pactAvatarYou: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.cyan
  },
  pactAvatarMatch: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    backgroundColor: colors.panelSoft,
    marginLeft: -10
  },
  pactAvatarTextDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  pactCopy: {
    flex: 1
  },
  pactOpponent: {
    gap: 2
  },
  pactTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.bodyStrong
  },
  workoutCard: {
    overflow: 'hidden',
    padding: 0,
    marginBottom: spacing.md
  },
  videoPreview: {
    minHeight: 112,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.panelAlpha70
  },
  videoBadgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  creatorBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 5
  },
  channelBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 5
  },
  playCircle: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: 25,
    backgroundColor: colors.surfaceCyanProgress,
    ...cyberGlow.cyan
  },
  workoutCopy: {
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  workoutTitle: {
    marginBottom: 3,
    fontFamily: fontFamilies.display
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
