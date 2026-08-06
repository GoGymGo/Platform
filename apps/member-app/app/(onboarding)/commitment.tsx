import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
import {
  HUDBorderBox,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import {
  FirstRunPrimaryButton,
  FirstRunScreen,
  FirstRunSecondaryButton
} from '@/components/firstRun';
import { LegalConsentCheckbox } from '@/components/legal';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { resolveCategoryPodiumMultipliers } from '@/config/competition';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import {
  calculateWeeklyMatchEntries,
  type WeeklyMatchMultiplier
} from '@/domain/campaignEconomics';
import { getCompetitionMonthKey, getCompetitionRegionDateKey } from '@/domain/competition';
import {
  buildRemainderDayOptions,
  calculateMonthAwareCommitmentWeight,
  calculateRemainderDayEntries,
  getCompetitionRemainderDayCount,
  type RemainderDayCount
} from '@/domain/commitmentProjection';
import { getCompetitionDateRange } from '@/domain/competitionEnrollment';
import { goBackOrReplace } from '@/navigation/goBack';
import { useCompetitionRegistration } from '@/hooks/useCompetitionRegistration';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { clearScreenMemory, useScreenMemory } from '@/hooks/useScreenMemory';
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

export default function CommitmentScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotionPreference();
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
  const defaultCompetitionMonthKey = getCompetitionMonthKey(
    registrationReferenceDateKey
  );
  const jurisdictionCode = regionVerification?.jurisdictionCode || 'GLOBAL';
  const registration = useCompetitionRegistration({
    defaultMonthKey: defaultCompetitionMonthKey,
    jurisdictionCode,
    regionCode: regionVerification?.regionCode ?? '',
    regionVerification
  });
  const upcomingCompetitionMonthKey = registration.competitionMonthKey;
  const categoryMultipliers = resolveCategoryPodiumMultipliers(
    registration.competition?.rules
  );
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
  const publishedGoalOptions = registration.competition?.goalDays?.filter(
    (day) => dayOptions.includes(day as (typeof dayOptions)[number])
  );
  const availableGoalOptions =
    publishedGoalOptions && publishedGoalOptions.length > 0
      ? publishedGoalOptions
      : dayOptions;
  const maximumSelectableGoal = Math.max(...availableGoalOptions);
  const competitionDateRange = getCompetitionDateRange(
    upcomingCompetitionMonthKey
  );
  const draftKey = `weekly-goal:${user?.uid ?? 'anonymous'}:${upcomingCompetitionMonthKey}`;
  const [days, setDays] = useScreenMemory(`${draftKey}:days`, () =>
    Math.min(weeklyGoal, maximumSelectableGoal)
  );
  const [goalSelected, setGoalSelected] = useScreenMemory(
    `${draftKey}:selected`,
    false
  );
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
  const competitionDayCount = 28 + maximumRemainderDays;
  const remainderHelper =
    maximumRemainderDays === 0
      ? 'This competition has no Bonus Days after the four scoring weeks.'
      : selectedBonusDays > 0
        ? `${selectedBonusDays} selected x your ${days}-day goal = ${remainderDayEntries} ${remainderDayEntries === 1 ? 'entry' : 'entries'}. A Perfect Month multiplies these Bonus Day entries by 10.`
        : `This ${competitionDayCount}-day competition has ${maximumRemainderDays} Bonus ${maximumRemainderDays === 1 ? 'Day' : 'Days'} after day 28. Each verified Bonus Day is worth your ${days}-day goal before 10x.`;

  useEffect(() => {
    void recordFlowMetric(user?.uid, 'weekly-goal-viewed', 'weekly-goal');
  }, [user?.uid]);

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

  async function confirmWeeklyGoal() {
    setConfirmationError(null);
    if (!goalSelected || !ageEligibilityAttested || !competitionRulesAccepted) {
      setConfirmationError('Review and accept the competition agreement.');
      return;
    }

    try {
      const enrollmentResult = await registration.register(days);
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
      if (isGymScanSource) {
        router.replace('/qr-scanner?posterScan=1');
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
      setConfirmationError(
        error instanceof Error ? error.message : 'Registration could not be completed. Try again.'
      );
    }
  }

  const registrationRequirementsAccepted = ageEligibilityAttested && competitionRulesAccepted;

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
          onBack={() => goBackOrReplace(
            router,
            isHomeSource
              ? '/home'
              : isGymScanSource
                ? '/region?source=gym-scan'
                : '/region'
          )}
          progress={100}
          step="SETUP // 2 OF 2"
        />

        <TerminalText style={styles.title} tone="text" variant="title">
          CHOOSE YOUR WEEKLY GOAL
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Choose a realistic number of workout days you can repeat each week.
        </TerminalText>

        <HUDBorderBox style={styles.joinWindowNotice} tone="muted">
          <TerminalText tone="cyan" variant="label">
            SEPTEMBER COMPETITION
          </TerminalText>
          <TerminalText style={styles.editorialCaption} tone="muted" uppercase={false} variant="caption">
            {`You may join this competition until it ends on ${competitionDateRange.endDateKey}. Your entries begin when enrollment is confirmed.`}
          </TerminalText>
        </HUDBorderBox>

        <View accessibilityRole="radiogroup" style={styles.dayPicker}>
          {dayOptions.map((day) => {
            const available = availableGoalOptions.includes(day);

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
              <TerminalText style={styles.goalSummaryValue} tone="green" variant="title">
                {days}
              </TerminalText>
              <TerminalText tone="dim" variant="micro">
                ENTRIES / HIT WEEK
              </TerminalText>
            </View>
            <View style={styles.goalSummaryDivider} />
            <View style={styles.goalSummaryItem}>
              <TerminalText style={styles.goalSummaryValue} tone="pink" variant="title">
                {baseMonthEntries}
              </TerminalText>
              <TerminalText tone="dim" variant="micro">
                FOUR-WEEK BASE
              </TerminalText>
            </View>
            <View style={styles.bonusSummary}>
              <TerminalText style={styles.editorialCaption} tone="muted" uppercase={false} variant="caption">
                Earn more through consistency, teamwork and competition.
              </TerminalText>
              <CompactTextButton
                label="VIEW BONUS DETAILS"
                onPress={() => setShowCalculator(true)}
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
              <TerminalText style={styles.editorialBody} tone="muted" uppercase={false} variant="body">
                Accept the rules and lock this goal for the month.
              </TerminalText>
              <CompactTextButton
                label="VIEW OFFICIAL CONTEST RULES"
                onPress={() => router.push('/official-rules')}
              />
              <LegalConsentCheckbox
                checked={competitionRulesAccepted}
                label={`I accept the competition rules and lock my ${days}-day weekly goal.`}
                onToggle={() => setCompetitionRulesAccepted((current) => !current)}
              />
              <LegalConsentCheckbox
                checked={ageEligibilityAttested}
                label="I meet the minimum age for my verified region."
                onToggle={() => setAgeEligibilityAttested((current) => !current)}
              />
              {confirmationError ? (
                <AuthStatusNotice message={confirmationError} tone="red" />
              ) : null}
            </HUDBorderBox>

            <FirstRunPrimaryButton
              disabled={!registrationRequirementsAccepted || registration.busy}
              label={registration.busy ? 'CHECKING REGISTRATION...' : 'CONFIRM + REGISTER ->'}
              onPress={() => void confirmWeeklyGoal()}
              style={styles.topConfirmButton}
            />
          </>
        ) : (
          <TerminalText
            style={styles.selectionHelper}
            tone="dim"
            uppercase={false}
            variant="caption"
          >
            Select your weekly goal to review and confirm the competition agreement.
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
        Hit your goal for 1x. Both partners hit for 2x. Complete the available bonus condition for
        3x. Miss your goal and that week earns 0.
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

  return '1X, weekly goal hit';
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
  joinWindowNotice: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.statusWarning,
    backgroundColor: colors.surfaceWarning
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
  selectionHelper: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamilies.ui,
    textAlign: 'center'
  },
  topConfirmButton: {
    marginBottom: spacing.md
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
