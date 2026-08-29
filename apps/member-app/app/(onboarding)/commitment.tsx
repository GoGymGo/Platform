import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View
} from 'react-native';

import { AuthStatusNotice } from '@/components/auth';
import { HUDBorderBox, ScreenScrollView, TerminalText } from '@/components/cyber';
import {
  FirstRunPrimaryButton,
  FirstRunScreen,
  FirstRunSecondaryButton
} from '@/components/firstRun';
import { LegalConsentCheckbox } from '@/components/legal';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { getUserFacingErrorMessage } from '@/components/reliability';
import { SessionUnavailable } from '@/components/session';
import { resolveCategoryPodiumMultipliers } from '@/config/competition';
import { colors, cyberGlow, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useRewardCatalog } from '@/data/appDataHooks';
import { gymLocationAccuracyWarning } from '@/constants/gymScan';
import {
  calculateWeeklyMatchEntries,
  type WeeklyMatchMultiplier
} from '@/domain/campaignEconomics';
import {
  getCompetitionMonthKey,
  getCompetitionRegionDateKey
} from '@/domain/competition';
import { getWorkoutCompletionDeadline } from '@/domain/competitionTiming';
import { readEnrollmentGymPresence } from '@/domain/enrollmentGymPresence';
import { isGymLocationAccuracyValidationMessage } from '@/domain/gymScan';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import type { RewardCatalogItem } from '@/domain/rewards';
import {
  buildRemainderDayOptions,
  calculateMaximumCommitmentEntries,
  calculateMonthAwareCommitmentWeight,
  calculateRemainderDayEntries,
  getCompetitionRemainderDayCount,
  type RemainderDayCount
} from '@/domain/commitmentProjection';
import type {
  CreateCompetitionEnrollmentInput,
  CurrentCompetition
} from '@/domain/accountReadiness';
import { goBackOrReplace } from '@/navigation/goBack';
import { useCompetitionRegistration } from '@/hooks/useCompetitionRegistration';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { clearScreenMemory, useScreenMemory } from '@/hooks/useScreenMemory';
import { ApiError } from '@/services/api/client';
import { readGymScanLocation } from '@/services/gymScanLocation';
import {
  readPendingGymScan,
  rememberCompetitionGymAccess,
  type PendingGymScan
} from '@/services/pendingGymScan';
import { useAppTour } from '@/state/appTour';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';

const dayOptions = [1, 2, 3, 4, 5, 6, 7] as const;
const matchOptions = [
  { label: 'MISS', value: 0 },
  { label: '1X', value: 1 },
  { label: '2X', value: 2 },
  { label: '3X', value: 3 }
] as const;
const defaultWeeklyMatchMultipliers: readonly WeeklyMatchMultiplier[] = [1, 1, 1, 1];
type CategoryRank = 0 | 1 | 2 | 3;
type ConfirmationPhase = 'idle' | 'locating' | 'registering';

function formatContestWindowDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'long',
    timeZone,
    year: 'numeric'
  }).format(new Date(value));
}

export default function CommitmentScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (!mobileGymVerificationAvailable && !appTourActive) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO HOME"
        body="Contest gym selection and live-location confirmation must be completed in GoGymGo on a phone or tablet."
        onAction={() => router.replace('/home')}
        title="PHONE OR TABLET REQUIRED"
      />
    );
  }

  return <MobileCommitmentScreen />;
}

function MobileCommitmentScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotionPreference();
  const { active: appTourActive } = useAppTour();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { user } = useAuth();
  const isHomeSource = source === 'home';
  const isGymScanSource = source === 'gym-scan';
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const { setWeeklyGoal, weeklyGoal } = useWorkoutProgress();
  const registrationReferenceDateKey = getCompetitionRegionDateKey(
    new Date(),
    competitionRegion.timeZone
  );
  const defaultCompetitionMonthKey = getCompetitionMonthKey(registrationReferenceDateKey);
  const jurisdictionCode = regionVerification?.jurisdictionCode || 'GLOBAL';
  const [pendingGymScan, setPendingGymScan] = useState<PendingGymScan | null>(null);
  const [pendingGymScanHydrated, setPendingGymScanHydrated] = useState(false);
  const registration = useCompetitionRegistration({
    defaultMonthKey: defaultCompetitionMonthKey,
    enabled: pendingGymScanHydrated,
    gymQrCredential: pendingGymScan?.credential ?? null,
    gymQrScanKey: pendingGymScan?.createdAt ?? null,
    jurisdictionCode,
    regionCode: regionVerification?.regionCode ?? '',
    regionVerification
  });
  const upcomingCompetitionMonthKey = registration.competitionMonthKey;
  const rewardsQuery = useRewardCatalog(
    registration.competition?.regionCode ?? '',
    registration.competition?.monthKey,
    registration.competition?.id
  );
  const contestRewards = (rewardsQuery.data ?? []).filter(
    (reward) => reward.competitionId === registration.competition?.id
  );
  const contestContextLoading =
    !pendingGymScanHydrated || registration.competitionLoading;
  const categoryMultipliers = resolveCategoryPodiumMultipliers(registration.competition?.rules);
  const categoryOptions = [
    { label: 'NONE', value: 0 },
    {
      label: `1ST // ${categoryMultipliers[1]}X`,
      value: 1
    },
    {
      label: `2ND // ${categoryMultipliers[2]}X`,
      value: 2
    },
    {
      label: `3RD // ${categoryMultipliers[3]}X`,
      value: 3
    }
  ] as const;
  const publishedGoalOptions = registration.competition?.goalDays?.filter((day) =>
    dayOptions.includes(day as (typeof dayOptions)[number])
  );
  const availableGoalOptions = publishedGoalOptions ?? [];
  const maximumSelectableGoal = availableGoalOptions.length > 0
    ? Math.max(...availableGoalOptions)
    : weeklyGoal;
  const draftKey = `weekly-goal:${user?.uid ?? 'anonymous'}:${upcomingCompetitionMonthKey}`;
  const [days, setDays] = useScreenMemory(`${draftKey}:days`, () =>
    Math.min(weeklyGoal, maximumSelectableGoal)
  );
  const [goalSelected, setGoalSelected] = useScreenMemory(`${draftKey}:selected`, false);
  const [weeklyMatchMultipliers, setWeeklyMatchMultipliers] = useScreenMemory<
    readonly WeeklyMatchMultiplier[]
  >(`${draftKey}:match-results`, defaultWeeklyMatchMultipliers);
  const [categoryRank, setCategoryRank] = useScreenMemory<CategoryRank>(
    `${draftKey}:category-rank`,
    0
  );
  const [perfectMonth, setPerfectMonth] = useScreenMemory(`${draftKey}:perfect-month`, false);
  const [bonusDays, setBonusDays] = useScreenMemory<RemainderDayCount>(`${draftKey}:bonus-days`, 0);
  const [showCalculator, setShowCalculator] = useScreenMemory(`${draftKey}:calculator-open`, false);
  const [ageEligibilityAttested, setAgeEligibilityAttested] = useState(false);
  const [competitionRulesAccepted, setCompetitionRulesAccepted] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [cameraPermissionBusy, setCameraPermissionBusy] = useState(false);
  const [gymPresenceStatus, setGymPresenceStatus] = useState<'checking' | 'missing' | 'ready'>(
    'checking'
  );
  const [confirmationPhase, setConfirmationPhase] = useState<ConfirmationPhase>('idle');
  const calculatorDialogRef = useRef<View>(null);
  const baseMonthEntries = days * 4;
  const weeklyMatchEntries = calculateWeeklyMatchEntries(days, weeklyMatchMultipliers);
  const matchAdjustedEntries = weeklyMatchEntries.reduce((total, entries) => total + entries, 0);
  const perfectMonthAvailable = weeklyMatchMultipliers.every((multiplier) => multiplier > 0);
  const perfectMonthMultiplier: 1 | 10 = perfectMonth && perfectMonthAvailable ? 10 : 1;
  const maximumRemainderDays = getCompetitionRemainderDayCount(upcomingCompetitionMonthKey);
  const bonusDayOptions = buildRemainderDayOptions(upcomingCompetitionMonthKey);
  const selectedBonusDays = Math.min(bonusDays, maximumRemainderDays) as RemainderDayCount;
  const remainderDayEntries = calculateRemainderDayEntries(
    days,
    selectedBonusDays,
    upcomingCompetitionMonthKey
  );
  const projection = calculateMonthAwareCommitmentWeight(
    {
      perfectMonthMultiplier,
      periodEntriesBeforePerfectMonth: matchAdjustedEntries,
      remainderDayCount: selectedBonusDays,
      weeklyGoal: days,
      signupEntries: 0
    },
    categoryRank === 0 ? null : categoryRank,
    upcomingCompetitionMonthKey,
    { categoryPodiumMultipliers: categoryMultipliers }
  );
  const maximumDrawEntries = calculateMaximumCommitmentEntries(days, upcomingCompetitionMonthKey, {
    categoryPodiumMultipliers: categoryMultipliers
  });
  const competitionDayCount = 28 + maximumRemainderDays;
  const remainderHelper =
    maximumRemainderDays === 0
      ? 'This Contest has no Bonus Days after the four scoring weeks.'
      : selectedBonusDays > 0
        ? `${selectedBonusDays} selected x your ${days}-day goal = ${remainderDayEntries} ${remainderDayEntries === 1 ? 'entry' : 'entries'}. A Perfect Month multiplies these Bonus Day entries by 10.`
        : `This ${competitionDayCount}-day Contest has ${maximumRemainderDays} Bonus ${maximumRemainderDays === 1 ? 'Day' : 'Days'} after day 28. Each verified Bonus Day is worth your ${days}-day Weekly Goal before 10x.`;

  useEffect(() => {
    void recordFlowMetric(user?.uid, 'weekly-goal-viewed', 'weekly-goal');
  }, [user?.uid]);

  useEffect(() => {
    if (pendingGymScanHydrated && isHomeSource && registration.alreadyEnrolled) {
      router.replace('/home');
    }
  }, [isHomeSource, pendingGymScanHydrated, registration.alreadyEnrolled, router]);

  useEffect(() => {
    let active = true;

    void readPendingGymScan()
      .then((pending) => {
        if (active) {
          setPendingGymScan(pending);
          setGymPresenceStatus(pending ? 'ready' : 'missing');
          setPendingGymScanHydrated(true);
        }
      })
      .catch(() => {
        if (active) {
          setPendingGymScan(null);
          setGymPresenceStatus('missing');
          setPendingGymScanHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function selectWeeklyMatchResult(index: number, multiplier: WeeklyMatchMultiplier) {
    setWeeklyMatchMultipliers((current) =>
      current.map((value, currentIndex) => (currentIndex === index ? multiplier : value))
    );
    if (multiplier === 0) {
      setPerfectMonth(false);
    }
  }

  function closeCalculator() {
    setShowCalculator(false);
  }

  async function openGymScanner() {
    if (cameraPermissionBusy) return;
    setConfirmationError(null);
    setCameraPermissionBusy(true);

    try {
      if (!appTourActive) {
        const permission = await Camera.getCameraPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          await Camera.requestCameraPermissionsAsync();
        }
      }
    } catch {
      // The scanner has the full permission recovery UI if the native prompt fails.
    } finally {
      setCameraPermissionBusy(false);
      router.push('/qr-scanner?enrollment=1');
    }
  }

  async function confirmWeeklyGoal() {
    setConfirmationError(null);
    if (!goalSelected || !ageEligibilityAttested || !competitionRulesAccepted) {
      setConfirmationError('Review and accept the Contest agreement.');
      return;
    }

    try {
      setConfirmationPhase(
        !appTourActive && !registration.alreadyEnrolled ? 'locating' : 'registering'
      );
      let gymPresence: CreateCompetitionEnrollmentInput['gymPresence'] | undefined;
      let confirmedGymScan: PendingGymScan | null = null;
      if (!appTourActive && !registration.alreadyEnrolled) {
        const { location, pendingScan } = await readEnrollmentGymPresence({
          readLocation: readGymScanLocation,
          readPendingScan: readPendingGymScan
        });
        if (!pendingScan?.credential) {
          setGymPresenceStatus('missing');
          setConfirmationError(
            'Scan the active QR poster at a Partner gym before confirming registration.'
          );
          return;
        }
        confirmedGymScan = pendingScan;
        if (location.status !== 'location-read') {
          setConfirmationError(
            location.status === 'permission-denied'
              ? 'Location access is required to confirm you are within 75 metres of the Partner gym. Allow location, then try again.'
              : 'Your live location could not be read. Check location services at the gym, then try again.'
          );
          return;
        }
        gymPresence = {
          accuracyMeters: location.accuracyMeters,
          credential: pendingScan.credential,
          latitude: location.latitude,
          longitude: location.longitude
        };
      }
      setConfirmationPhase('registering');
      const enrollmentResult = await registration.register(days, gymPresence);
      if (confirmedGymScan && registration.competition) {
        try {
          await rememberCompetitionGymAccess({
            competitionId: registration.competition.id,
            credentialValidUntil: getWorkoutCompletionDeadline(
              registration.competition.endsAt
            ).toISOString()
          });
        } catch {
          // Enrollment remains authoritative if device storage becomes unavailable.
        }
      }
      setWeeklyGoal(enrollmentResult.goalDays, upcomingCompetitionMonthKey);
      [
        'days',
        'selected',
        'match-results',
        'category-rank',
        'perfect-month',
        'bonus-days',
        'calculator-open'
      ].forEach((key) => clearScreenMemory(`${draftKey}:${key}`));
      const selectedContest = registration.competition;
      const selectedContestAcceptsWorkouts =
        selectedContest?.status === 'active';
      if (isGymScanSource && selectedContestAcceptsWorkouts) {
        router.replace('/qr-scanner');
      } else {
        router.replace({
          pathname: '/home',
          params: {
            goalDays: String(enrollmentResult.goalDays),
            registered: '1'
          }
        });
      }
    } catch (error) {
      setConfirmationError(getRegistrationErrorMessage(error));
    } finally {
      setConfirmationPhase('idle');
    }
  }

  const gymPresenceReady = registration.alreadyEnrolled || gymPresenceStatus === 'ready';
  const registrationRequirementsAccepted =
    ageEligibilityAttested && competitionRulesAccepted && gymPresenceReady;

  return (
    <FirstRunScreen>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey={draftKey}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <OnboardingHeader
          label="WEEKLY GOAL"
          onBack={() =>
            goBackOrReplace(
              router,
              isHomeSource ? '/home' : isGymScanSource ? '/region?source=gym-scan' : '/region'
            )
          }
          progress={100}
          step="SETUP // 2 OF 2"
        />

        <TerminalText style={styles.title} tone="text" variant="title">
          CHOOSE YOUR WEEKLY GOAL
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Choose how many days you&apos;ll train each week.
        </TerminalText>

        {contestContextLoading ? (
          <HUDBorderBox style={styles.contestContextCard} tone="muted">
            <TerminalText live="polite" tone="cyan" variant="label">
              LOADING CONTEST DETAILS...
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              {isGymScanSource
                ? 'Matching this QR to its Contest.'
                : 'Loading your Contest.'}
            </TerminalText>
          </HUDBorderBox>
        ) : registration.competition ? (
          <ContestEntryContext
            isQrSelected={Boolean(pendingGymScan)}
            rewards={contestRewards}
            rewardsError={rewardsQuery.isError}
            rewardsLoading={rewardsQuery.isPending}
            timeZone={competitionRegion.timeZone}
            competition={registration.competition}
          />
        ) : (
          <HUDBorderBox style={styles.contestContextError} tone="amber">
            <TerminalText tone="amber" variant="label">
              CONTEST DETAILS UNAVAILABLE
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              {pendingGymScan || registration.competitionError
                ? 'This QR doesn\'t match an open Contest. Scan the current poster.'
                : 'No Contest is open in your region.'}
            </TerminalText>
            {pendingGymScan ? (
              <FirstRunSecondaryButton
                disabled={cameraPermissionBusy}
                label={cameraPermissionBusy ? 'OPENING CAMERA...' : 'SCAN CURRENT CONTEST QR'}
                onPress={() => void openGymScanner()}
                style={styles.contextRetryButton}
                tone="amber"
              />
            ) : null}
          </HUDBorderBox>
        )}

        <View accessibilityRole="radiogroup" style={styles.dayPicker}>
          {dayOptions.map((day) => {
            const available =
              Boolean(registration.competition) &&
              !contestContextLoading &&
              availableGoalOptions.includes(day);

            return (
              <Pressable
                aria-checked={goalSelected && days === day}
                aria-disabled={!available}
                accessibilityLabel={`${day} ${day === 1 ? 'day' : 'days'} per week`}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: goalSelected && days === day,
                  disabled: !available
                }}
                disabled={!available}
                key={day}
                onPress={() => {
                  setDays(day);
                  setGoalSelected(true);
                }}
                style={[
                  styles.dayButton,
                  !available
                    ? styles.dayButtonUnavailable
                    : goalSelected && days === day
                      ? styles.dayButtonActive
                      : styles.dayButtonIdle
                ]}
              >
                <TerminalText
                  glow={goalSelected && days === day}
                  tone={!available ? 'muted' : goalSelected && days === day ? 'cyan' : 'dim'}
                  variant="button"
                >
                  {day}
                </TerminalText>
                <TerminalText
                  tone={!available ? 'muted' : goalSelected && days === day ? 'cyan' : 'dim'}
                  variant="micro"
                >
                  {day === 1 ? 'DAY' : 'DAYS'}
                </TerminalText>
              </Pressable>
            );
          })}
        </View>

        {goalSelected ? (
          <HUDBorderBox style={styles.goalSummary} tone="cyan">
            <View style={styles.goalSummaryItem}>
              <TerminalText style={styles.goalSummaryValue} tone="cyan" variant="title">
                {days}
              </TerminalText>
              <TerminalText tone="dim" variant="micro">
                DAYS / WEEK
              </TerminalText>
            </View>
            <View style={styles.goalSummaryDivider} />
            <View style={styles.goalSummaryItem}>
              <TerminalText style={styles.goalSummaryValue} tone="pink" variant="title">
                {maximumDrawEntries.toLocaleString()}
              </TerminalText>
              <TerminalText tone="dim" variant="micro">
                MAXIMUM DRAW ENTRIES
              </TerminalText>
            </View>
            <View style={styles.bonusSummary}>
              <TerminalText
                style={styles.editorialCaption}
                tone="muted"
                uppercase={false}
                variant="caption"
              >
                See how entries add up.
              </TerminalText>
              <FirstRunSecondaryButton
                label="VIEW ENTRY CALCULATOR →"
                onPress={() => setShowCalculator(true)}
                style={styles.bonusDetailsCta}
                tone="amber"
              />
            </View>
          </HUDBorderBox>
        ) : null}

        {goalSelected ? (
          <>
            <HUDBorderBox style={styles.registrationConsent} tone="muted">
              <TerminalText tone="cyan" variant="label">
                CONFIRM YOUR {days}-DAY GOAL
              </TerminalText>
              <TerminalText
                style={styles.editorialBody}
                tone="muted"
                uppercase={false}
                variant="body"
              >
                {gymPresenceReady
                  ? 'Accept the rules to lock your goal.'
                  : 'Scan this Contest\'s gym QR first.'}
              </TerminalText>
              <CompactTextButton
                label="VIEW OFFICIAL CONTEST RULES"
                onPress={() => router.push('/official-rules')}
              />
              <HUDBorderBox
                style={styles.presenceConfirmation}
                tone={gymPresenceReady ? 'cyan' : 'amber'}
              >
                <TerminalText tone={gymPresenceReady ? 'cyan' : 'amber'} variant="micro">
                  GYM LOCATION CHECK
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  {gymPresenceReady
                    ? 'Gym selected. Confirm while you\'re within 75 metres.'
                    : 'Scan this Contest\'s poster while you\'re at the gym.'}
                </TerminalText>
                {!registration.alreadyEnrolled ? (
                  !gymPresenceReady ? (
                    <FirstRunPrimaryButton
                      accessibilityHint="Requests camera access and opens the Partner gym QR scanner for initial gym selection."
                      disabled={cameraPermissionBusy}
                      label={
                        cameraPermissionBusy
                          ? 'OPENING CAMERA...'
                          : 'SCAN CONTEST QR ->'
                      }
                      onPress={() => void openGymScanner()}
                      style={styles.scanCta}
                      tone="amber"
                    />
                  ) : null
                ) : null}
              </HUDBorderBox>
              {gymPresenceReady ? (
                <>
                  <LegalConsentCheckbox
                    checked={competitionRulesAccepted}
                    label={`I accept the Contest rules and lock my ${days}-day Weekly Goal.`}
                    onToggle={() => setCompetitionRulesAccepted((current) => !current)}
                  />
                  <LegalConsentCheckbox
                    checked={ageEligibilityAttested}
                    label="I meet the minimum age for my verified region."
                    onToggle={() => setAgeEligibilityAttested((current) => !current)}
                  />
                </>
              ) : null}
              {confirmationError ? (
                <AuthStatusNotice message={confirmationError} tone="red" />
              ) : null}
            </HUDBorderBox>

            {gymPresenceReady ? (
              confirmationPhase !== 'idle' ? (
                <GymLocationVerificationProgress
                  phase={confirmationPhase}
                  reduceMotion={reduceMotion}
                />
              ) : (
                <FirstRunPrimaryButton
                  disabled={!registrationRequirementsAccepted || registration.busy}
                  label={registration.busy ? 'JOINING CONTEST...' : 'JOIN CONTEST ->'}
                  onPress={() => void confirmWeeklyGoal()}
                  style={styles.topConfirmButton}
                />
              )
            ) : null}
          </>
        ) : (
          <TerminalText
            style={styles.selectionHelper}
            tone="dim"
            uppercase={false}
            variant="caption"
          >
            Select your Weekly Goal.
          </TerminalText>
        )}
      </ScreenScrollView>

      <Modal
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={closeCalculator}
        onShow={() => {
          if (Platform.OS === 'web') {
            const dialog = calculatorDialogRef.current as unknown as {
              focus?: () => void;
            };
            dialog.focus?.();
            return;
          }

          const node = findNodeHandle(calculatorDialogRef.current);
          if (node) {
            AccessibilityInfo.setAccessibilityFocus(node);
          }
        }}
        transparent
        visible={showCalculator}
      >
        <View style={styles.calculatorModalOverlay}>
          <HUDBorderBox style={styles.calculatorModalDialog} tone="cyan">
            <View
              accessibilityLabel="Scoring calculator"
              accessibilityViewIsModal
              ref={calculatorDialogRef}
              style={styles.calculatorModalBody}
              tabIndex={-1}
            >
              <View style={styles.calculatorModalHeader}>
                <TerminalText tone="cyan" variant="label">
                  SCORING CALCULATOR
                </TerminalText>
                <FirstRunSecondaryButton
                  label="EXIT"
                  onPress={closeCalculator}
                  style={styles.calculatorExitButton}
                />
              </View>

              <ScrollView
                contentContainerStyle={styles.calculatorModalContent}
                showsVerticalScrollIndicator={false}
                style={styles.calculatorModalScroll}
              >
                <HUDBorderBox style={styles.baseProjection} tone="cyan">
                  <View>
                    <TerminalText tone="muted" variant="micro">
                      YOUR FOUR-WEEK BASE
                    </TerminalText>
                    <TerminalText
                      accessibilityRole="text"
                      style={styles.baseProjectionValue}
                      tone="cyan"
                      variant="title"
                    >
                      {days} X 4 = {baseMonthEntries} ENTRIES
                    </TerminalText>
                  </View>
                  <TerminalText tone="dim" uppercase={false} variant="caption">
                    Open How Scoring Works to try each week&apos;s Weekly Challenge result, your
                    goal-group finish, Bonus Days 29-31 and the final Perfect Month 10x.
                  </TerminalText>
                </HUDBorderBox>

                <HUDBorderBox style={styles.calculationPanel} tone="cyan">
                  <TerminalText tone="cyan" variant="label">
                    HOW SCORING WORKS
                  </TerminalText>
                  <TerminalText
                    style={styles.calculatorIntro}
                    tone="muted"
                    uppercase={false}
                    variant="body"
                  >
                    Try possible weekly results to see how bonuses change your entries.
                  </TerminalText>

                  <WeeklyMatchControl
                    days={days}
                    multipliers={weeklyMatchMultipliers}
                    onSelect={selectWeeklyMatchResult}
                  />
                  <ChoiceControl
                    helper={`Finishing first, second or third in your Weekly Goal group multiplies the four-week Weekly Challenge subtotal by ${categoryMultipliers[1]}x, ${categoryMultipliers[2]}x or ${categoryMultipliers[3]}x.`}
                    label="2 // TOP THREE GOAL-GROUP FINISHERS"
                    onSelect={(value) => setCategoryRank(value as CategoryRank)}
                    options={categoryOptions}
                    selectedTone={(value) => (value === 0 ? 'muted' : 'pink')}
                    selectedValue={categoryRank}
                  />

                  <ChoiceControl
                    helper={remainderHelper}
                    label={
                      maximumRemainderDays === 0
                        ? '3 // NO BONUS DAYS'
                        : `3 // BONUS DAYS 29-31 // ${maximumRemainderDays} AVAILABLE`
                    }
                    onSelect={(value) => setBonusDays(value as RemainderDayCount)}
                    options={bonusDayOptions}
                    selectedTone={(value) => (value === 0 ? 'muted' : 'pink')}
                    selectedValue={selectedBonusDays}
                  />

                  <View style={styles.toggleRow}>
                    <View style={styles.toggleCopy}>
                      <TerminalText tone="cyan" variant="label">
                        4 // PERFECT MONTH
                      </TerminalText>
                      <TerminalText tone="muted" variant="caption">
                        {perfectMonthAvailable
                          ? 'Apply the final 10x after Weekly Challenge, goal-group and Bonus Day results.'
                          : 'Miss any Weekly Goal and the Perfect Month 10x is not available.'}
                      </TerminalText>
                    </View>
                    <Switch
                      accessibilityLabel="Perfect month 10x"
                      disabled={!perfectMonthAvailable}
                      onValueChange={setPerfectMonth}
                      thumbColor={perfectMonth ? colors.pink : colors.dim}
                      trackColor={{
                        false: colors.panelSoft,
                        true: colors.surfacePinkActive
                      }}
                      value={perfectMonth && perfectMonthAvailable}
                    />
                  </View>

                  <TerminalText tone="dim" uppercase={false} variant="caption">
                    Weekly Challenge results are added first, followed by goal-group and Bonus Day
                    Entries. Perfect Month 10x is applied last. Your Free Entry is added once
                    without a multiplier.
                  </TerminalText>

                  <View style={styles.resultPanel}>
                    <TerminalText tone="muted" variant="label">
                      PROJECTED TOTAL
                    </TerminalText>
                    <TerminalText style={styles.resultValue} tone="pink" variant="display">
                      {projection.drawWeight.toLocaleString()}
                    </TerminalText>
                    <TerminalText tone="dim" variant="micro">
                      PRIZE DRAW ENTRIES
                    </TerminalText>
                  </View>
                </HUDBorderBox>
              </ScrollView>
            </View>
          </HUDBorderBox>
        </View>
      </Modal>
    </FirstRunScreen>
  );
}

function ContestEntryContext({
  competition,
  isQrSelected,
  rewards,
  rewardsError,
  rewardsLoading,
  timeZone
}: {
  competition: CurrentCompetition;
  isQrSelected: boolean;
  rewards: readonly RewardCatalogItem[];
  rewardsError: boolean;
  rewardsLoading: boolean;
  timeZone: string;
}) {
  const contestWindow = `${formatContestWindowDate(
    competition.startsAt,
    timeZone
  )} to ${formatContestWindowDate(competition.endsAt, timeZone)}`;

  return (
    <HUDBorderBox style={styles.contestContextCard} tone="cyan">
      <View style={styles.contestContextHeader}>
        <TerminalText tone="cyan" variant="label">
          YOUR CONTEST
        </TerminalText>
        {isQrSelected ? (
          <TerminalText tone="green" variant="micro">
            QR MATCHED
          </TerminalText>
        ) : null}
      </View>

      <TerminalText style={styles.contestName} tone="text" variant="body">
        {competition.name}
      </TerminalText>

      <View style={styles.contestDetails}>
        <View style={styles.contestDetailRow}>
          <TerminalText style={styles.contestDetailLabel} tone="dim" variant="micro">
            LOCATION
          </TerminalText>
          <TerminalText
            style={styles.contestDetailValue}
            tone="muted"
            uppercase={false}
            variant="caption"
          >
            {competition.regionName}
          </TerminalText>
        </View>
        <View style={styles.contestDetailRow}>
          <TerminalText style={styles.contestDetailLabel} tone="dim" variant="micro">
            DATES
          </TerminalText>
          <TerminalText
            style={styles.contestDetailValue}
            tone="muted"
            uppercase={false}
            variant="caption"
          >
            {contestWindow}
          </TerminalText>
        </View>
      </View>

      <View style={styles.contestOffers}>
        <TerminalText tone="pink" variant="micro">
          REWARDS
        </TerminalText>
        {rewardsLoading ? (
          <TerminalText live="polite" tone="muted" uppercase={false} variant="caption">
            Loading rewards...
          </TerminalText>
        ) : rewardsError ? (
          <TerminalText tone="muted" uppercase={false} variant="caption">
            Rewards couldn&apos;t load. You can still join.
          </TerminalText>
        ) : rewards.length === 0 ? (
          <TerminalText tone="muted" uppercase={false} variant="caption">
            Rewards coming soon.
          </TerminalText>
        ) : (
          <View style={styles.contestOfferList}>
            {rewards.map((reward) => (
              <View key={reward.id} style={styles.contestOffer}>
                <View style={styles.contestOfferHeader}>
                  <TerminalText style={styles.contestOfferTitle} tone="text" variant="body">
                    {reward.title}
                  </TerminalText>
                  <TerminalText tone="pink" variant="micro">
                    {reward.rewardType === 'coupon' ? 'COUPON' : 'PRIZE'}
                  </TerminalText>
                </View>
                <TerminalText tone="cyan" variant="micro">
                  OFFERED BY {reward.sponsorName}
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  {reward.description}
                </TerminalText>
              </View>
            ))}
          </View>
        )}
      </View>
    </HUDBorderBox>
  );
}

function WeeklyMatchControl({
  days,
  multipliers,
  onSelect
}: {
  days: number;
  multipliers: readonly WeeklyMatchMultiplier[];
  onSelect: (index: number, multiplier: WeeklyMatchMultiplier) => void;
}) {
  return (
    <View style={styles.controlGroup}>
      <TerminalText tone="cyan" variant="label">
        1 // WEEKLY CHALLENGE RESULTS
      </TerminalText>
      <TerminalText tone="dim" uppercase={false} variant="caption">
        Hit your goal: 1x. Both hit: 2x. Bonus condition: 3x. Miss: 0.
      </TerminalText>
      <View style={styles.weeklyMatchList}>
        {multipliers.map((selectedMultiplier, index) => (
          <View key={`weekly-match-${index + 1}`} style={styles.weeklyMatchRow}>
            <View style={styles.weeklyMatchLabel}>
              <TerminalText tone="text" variant="body">
                WEEK {index + 1}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                {getWeeklyOutcomeLabel(selectedMultiplier, days)}
              </TerminalText>
            </View>
            <View accessibilityRole="radiogroup" style={styles.weeklyMatchOptions}>
              {matchOptions.map((option) => {
                const selected = selectedMultiplier === option.value;

                return (
                  <Pressable
                    aria-checked={selected}
                    accessibilityLabel={`Week ${index + 1}, ${getWeeklyOptionAccessibilityLabel(option.value)}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => onSelect(index, option.value)}
                    style={[
                      styles.weeklyMatchOption,
                      selected
                        ? option.value === 0
                          ? styles.segmentActiveRed
                          : option.value === 3
                            ? styles.segmentActivePink
                            : styles.segmentActive
                        : null
                    ]}
                  >
                    <TerminalText
                      glow={selected}
                      tone={
                        selected && option.value === 3
                          ? 'pink'
                          : selected && option.value === 0
                            ? 'red'
                            : selected
                              ? 'cyan'
                              : 'dim'
                      }
                      variant="button"
                    >
                      {option.label}
                    </TerminalText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function getWeeklyOutcomeLabel(multiplier: WeeklyMatchMultiplier, days: number) {
  const entries = days * multiplier;

  if (multiplier === 0) {
    return 'GOAL MISSED // 0';
  }
  if (multiplier === 2) {
    return `BOTH HIT // ${entries}`;
  }
  if (multiplier === 3) {
    return `3X BONUS // ${entries}`;
  }

  return `GOAL HIT // ${entries}`;
}

function getWeeklyOptionAccessibilityLabel(multiplier: WeeklyMatchMultiplier) {
  if (multiplier === 0) {
    return 'goal missed, zero entries';
  }
  if (multiplier === 2) {
    return '2X, both players hit the goal';
  }
  if (multiplier === 3) {
    return '3X bonus';
  }

  return '1X, Weekly Goal hit';
}

function ChoiceControl({
  helper,
  label,
  onSelect,
  options,
  selectedTone,
  selectedValue
}: {
  helper: string;
  label: string;
  onSelect: (value: number) => void;
  options: readonly { label: string; value: number }[];
  selectedTone?: (value: number) => 'cyan' | 'pink' | 'muted';
  selectedValue: number;
}) {
  return (
    <View style={styles.controlGroup}>
      <TerminalText tone="cyan" variant="label">
        {label}
      </TerminalText>
      <View accessibilityRole="radiogroup" style={styles.segmentedControl}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          const activeTone = selectedTone?.(option.value) ?? 'cyan';

          return (
            <Pressable
              aria-checked={selected}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.segment,
                selected
                  ? activeTone === 'pink'
                    ? styles.segmentActivePink
                    : activeTone === 'muted'
                      ? styles.segmentActiveMuted
                      : styles.segmentActive
                  : null
              ]}
            >
              <TerminalText
                glow={selected}
                style={styles.segmentLabel}
                tone={selected ? activeTone : 'dim'}
                variant="button"
              >
                {option.label}
              </TerminalText>
            </Pressable>
          );
        })}
      </View>
      <TerminalText tone="dim" uppercase={false} variant="caption">
        {helper}
      </TerminalText>
    </View>
  );
}

function getRegistrationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = getApiErrorCode(error.body);
    const messages: Record<string, string> = {
      GYM_INACTIVE:
        'This Partner gym is not currently active. Ask the gym or try another participating location.',
      GYM_LOCATION_INACCURATE: gymLocationAccuracyWarning,
      GYM_NOT_ELIGIBLE_FOR_COMPETITION:
        'This Partner gym is not participating in the current regional Contest.',
      GYM_QR_INVALID:
        'That gym QR is inactive or has been replaced. Scan the current GoGymGo poster and try again.',
      OUTSIDE_GYM_GEOFENCE:
        'You must be within 75 metres of the Partner gym whose QR poster you scanned. Return to that gym and try again.'
    };
    if (code && messages[code]) return messages[code];
    if (
      /location.+not accurate enough/i.test(error.message) ||
      isGymLocationAccuracyValidationMessage(error.message)
    ) {
      return gymLocationAccuracyWarning;
    }
    if (error.status === 401) {
      return 'Your account session expired. Sign in again, then confirm registration.';
    }
    if (error.status < 500 && error.message.trim().length <= 180) {
      return error.message.trim();
    }
  }

  return getUserFacingErrorMessage(
    error,
    'Registration could not be completed. Your selections are still here; try again.'
  );
}

function getApiErrorCode(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const direct = body as { code?: unknown; error?: unknown };
  if (typeof direct.code === 'string') return direct.code;
  if (direct.error && typeof direct.error === 'object') {
    const nested = direct.error as { code?: unknown };
    return typeof nested.code === 'string' ? nested.code : null;
  }
  return null;
}

function GymLocationVerificationProgress({
  phase,
  reduceMotion
}: {
  phase: Exclude<ConfirmationPhase, 'idle'>;
  reduceMotion: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const locating = phase === 'locating';

  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(0.72);
      return;
    }

    progress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: 1_150,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: false
        }),
        Animated.timing(progress, {
          duration: 300,
          easing: Easing.linear,
          toValue: 0,
          useNativeDriver: false
        })
      ])
    );
    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [phase, progress, reduceMotion]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['14%', '100%']
  });

  return (
    <HUDBorderBox glow style={styles.locationProgressCard} tone="cyan">
      <View style={styles.locationProgressHeader}>
        <TerminalText live="polite" glow tone="cyan" variant="label">
          {locating ? 'ACQUIRING LIVE GYM POSITION' : 'SECURING CONTEST REGISTRATION'}
        </TerminalText>
        <TerminalText tone="cyan" variant="micro">
          {locating ? 'LIVE SIGNAL' : 'COMMITTING'}
        </TerminalText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          text: locating ? 'Acquiring live gym position' : 'Securing Contest registration'
        }}
        style={styles.locationProgressTrack}
      >
        <Animated.View style={[styles.locationProgressFill, { width: progressWidth }]}>
          <View style={styles.locationProgressLeadingEdge} />
        </Animated.View>
      </View>
      <View style={styles.locationProgressScale}>
        <TerminalText tone="dim" variant="micro">
          00
        </TerminalText>
        <TerminalText tone="dim" variant="micro">
          VERIFY
        </TerminalText>
        <TerminalText tone="dim" variant="micro">
          100
        </TerminalText>
      </View>
      <TerminalText
        style={styles.locationProgressCopy}
        tone="muted"
        uppercase={false}
        variant="caption"
      >
        {locating
          ? 'Hold still while we verify this gym.'
          : 'Gym confirmed. Joining Contest.'}
      </TerminalText>
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingLeft: 16,
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    lineHeight: 24
  },
  editorialBody: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 23
  },
  editorialCaption: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 21
  },
  registrationConsent: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  presenceConfirmation: {
    gap: spacing.xs,
    marginVertical: spacing.xs,
    padding: spacing.md
  },
  scanCta: {
    marginTop: spacing.sm
  },
  contestContextCard: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    backgroundColor: colors.surfaceCyanFaint
  },
  contestContextError: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.statusWarning,
    backgroundColor: colors.surfaceWarning
  },
  contextRetryButton: {
    marginTop: spacing.xs
  },
  contestContextHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  contestName: {
    fontFamily: fontFamilies.display,
    fontSize: 19,
    lineHeight: 24
  },
  contestDetails: {
    gap: spacing.xs,
    paddingTop: spacing.xs
  },
  contestDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  contestDetailLabel: {
    width: 64,
    paddingTop: 2
  },
  contestDetailValue: {
    minWidth: 0,
    flex: 1,
    fontFamily: fontFamilies.ui,
    lineHeight: 19
  },
  contestOffers: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  contestOfferList: {
    gap: spacing.sm
  },
  contestOffer: {
    gap: 3,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderPinkStrong
  },
  contestOfferHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  contestOfferTitle: {
    minWidth: 0,
    flex: 1,
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 20
  },
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  goalSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginBottom: spacing.md,
    padding: spacing.md
  },
  goalSummaryItem: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs
  },
  goalSummaryValue: {
    fontFamily: fontFamilies.display
  },
  goalSummaryDivider: {
    width: 1,
    backgroundColor: colors.borderCyanSubtle
  },
  bonusSummary: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  bonusDetailsCta: {
    width: '100%',
    marginTop: spacing.xs
  },
  selectionHelper: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamilies.ui,
    textAlign: 'center'
  },
  topConfirmButton: {
    marginBottom: spacing.md
  },
  locationProgressCard: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.panelAlpha70
  },
  locationProgressHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  locationProgressTrack: {
    width: '100%',
    height: 12,
    marginTop: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: 2,
    backgroundColor: colors.surfaceCyanProgress
  },
  locationProgressFill: {
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  locationProgressLeadingEdge: {
    width: 3,
    height: '100%',
    backgroundColor: colors.text
  },
  locationProgressScale: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  locationProgressCopy: {
    marginTop: spacing.xs,
    lineHeight: 20
  },
  dayButton: {
    width: '23%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 8
  },
  dayButtonActive: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  dayButtonIdle: {
    borderColor: colors.whiteAlpha08,
    backgroundColor: colors.panelAlpha45
  },
  dayButtonUnavailable: {
    opacity: 0.35,
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.panelSoft
  },
  calculationPanel: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  calculatorModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.background
  },
  calculatorModalDialog: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    padding: 0,
    overflow: 'hidden',
    backgroundColor: colors.panel
  },
  calculatorModalBody: {
    flexShrink: 1
  },
  calculatorModalHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCyanSubtle
  },
  calculatorExitButton: {
    minWidth: 92,
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  calculatorModalScroll: {
    flexShrink: 1
  },
  calculatorModalContent: {
    padding: spacing.md
  },
  baseProjection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  baseProjectionValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  calculatorIntro: {
    marginBottom: spacing.xs,
    fontFamily: fontFamilies.ui
  },
  controlGroup: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  weeklyMatchList: {
    gap: spacing.xs
  },
  weeklyMatchRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 8,
    backgroundColor: colors.panelAlpha70
  },
  weeklyMatchLabel: {
    width: 92,
    gap: 2
  },
  weeklyMatchOptions: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    gap: 3
  },
  weeklyMatchOption: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 8,
    backgroundColor: colors.panelAlpha70
  },
  segment: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 5
  },
  segmentLabel: {
    width: '100%',
    flexShrink: 1,
    fontSize: fontSizes.label,
    lineHeight: 14,
    textAlign: 'center'
  },
  segmentActive: {
    backgroundColor: colors.surfaceCyanActive
  },
  segmentActivePink: {
    backgroundColor: colors.surfacePinkActive
  },
  segmentActiveMuted: {
    backgroundColor: colors.surfaceMutedGlow
  },
  segmentActiveRed: {
    backgroundColor: colors.surfaceErrorActive
  },
  toggleRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs
  },
  resultPanel: {
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderPinkStrong,
    borderRadius: 8,
    backgroundColor: colors.surfacePinkFaint
  },
  resultValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displaySmall,
    lineHeight: 42
  }
});
