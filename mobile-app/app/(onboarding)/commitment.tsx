import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { SponsorRail } from '@/components/sponsor';
import { colors, fontFamilies, fontSizes, interactionStates, spacing } from '@/constants/theme';
import {
  calculateWeeklyMatchEntries,
  type WeeklyMatchMultiplier
} from '@/domain/campaignEconomics';
import {
  getCompetitionMonthKey,
  getCompetitionRegionDateKey
} from '@/domain/competition';
import {
  buildRemainderDayOptions,
  calculateMaximumCommitmentEntries,
  calculateMonthAwareCommitmentWeight,
  calculateRemainderDayEntries,
  getCompetitionRemainderDayCount,
  type RemainderDayCount
} from '@/domain/commitmentProjection';
import {
  getCompetitionDateRange,
  getRegistrationGoalLimit,
  getRegistrationGoalOptions,
  getRegistrationTargetCompetitionMonthKey
} from '@/domain/competitionEnrollment';
import { goBackOrReplace } from '@/navigation/goBack';
import { formatCampaignDate, useSponsorCampaign } from '@/state/sponsorCampaign';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';

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
  const { competitionRegion } = useCompetitionRegion();
  const { campaign, enrollment } = useSponsorCampaign();
  const categoryOptions = [
    { label: 'NONE', value: 0 },
    { label: `1ST // ${campaign.economics.categoryPodiumMultipliers[1]}X`, value: 1 },
    { label: `2ND // ${campaign.economics.categoryPodiumMultipliers[2]}X`, value: 2 },
    { label: `3RD // ${campaign.economics.categoryPodiumMultipliers[3]}X`, value: 3 }
  ] as const;
  const { setWeeklyGoal, weeklyGoal } = useWorkoutProgress();
  const registrationReferenceDateKey = getCompetitionRegionDateKey(
    new Date(),
    competitionRegion.timeZone
  );
  const upcomingCompetitionMonthKey = getRegistrationTargetCompetitionMonthKey(
    registrationReferenceDateKey
  );
  const maximumSelectableGoal = getRegistrationGoalLimit(
    upcomingCompetitionMonthKey,
    registrationReferenceDateKey
  );
  const availableGoalOptions = getRegistrationGoalOptions(
    upcomingCompetitionMonthKey,
    registrationReferenceDateKey
  );
  const lateRegistrationDay = Number(registrationReferenceDateKey.slice(-2));
  const lateRegistrationActive =
    upcomingCompetitionMonthKey ===
    getCompetitionMonthKey(registrationReferenceDateKey);
  const [days, setDays] = useState(() =>
    lateRegistrationActive
      ? maximumSelectableGoal
      : Math.min(weeklyGoal, maximumSelectableGoal)
  );
  const [weeklyMatchMultipliers, setWeeklyMatchMultipliers] = useState(
    defaultWeeklyMatchMultipliers
  );
  const [categoryRank, setCategoryRank] = useState<CategoryRank>(0);
  const [perfectMonth, setPerfectMonth] = useState(false);
  const [bonusDays, setBonusDays] = useState<RemainderDayCount>(0);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const baseMonthEntries = days * 4;
  const weeklyMatchEntries = calculateWeeklyMatchEntries(days, weeklyMatchMultipliers);
  const matchAdjustedEntries = weeklyMatchEntries.reduce(
    (total, entries) => total + entries,
    0
  );
  const perfectMonthAvailable = weeklyMatchMultipliers.every((multiplier) => multiplier > 0);
  const perfectMonthMultiplier: 1 | 10 = perfectMonth && perfectMonthAvailable ? 10 : 1;
  const upcomingCompetitionDates = getCompetitionDateRange(upcomingCompetitionMonthKey);
  const maximumRemainderDays = getCompetitionRemainderDayCount(
    upcomingCompetitionMonthKey
  );
  const bonusDayOptions = buildRemainderDayOptions(upcomingCompetitionMonthKey);
  const selectedBonusDays = Math.min(
    bonusDays,
    maximumRemainderDays
  ) as RemainderDayCount;
  const maximumPotentialEntries = calculateMaximumCommitmentEntries(
    days,
    upcomingCompetitionMonthKey,
    campaign.economics
  );
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
    campaign.economics
  );
  const remainderAdjustedEntries =
    projection.categoryAdjustedPeriodEntries + remainderDayEntries;
  const categoryLabel = categoryRank === 0 ? 'NO CATEGORY BONUS' : `${categoryRank === 1 ? '1ST' : categoryRank === 2 ? '2ND' : '3RD'} PLACE`;
  const sponsorCap = enrollment.maximumEntrants === null
    ? 'NO CAP THIS MONTH'
    : `${enrollment.maximumEntrants.toLocaleString()} PLAYER CAP`;
  const competitionDayCount = 28 + maximumRemainderDays;
  const remainderHelper = maximumRemainderDays === 0
    ? 'This competition has no Bonus Days after the four scoring weeks.'
    : selectedBonusDays > 0
      ? `${selectedBonusDays} selected x your ${days}-day goal = ${remainderDayEntries} ${remainderDayEntries === 1 ? 'entry' : 'entries'}. A Perfect Month multiplies these Bonus Day entries by 10.`
      : `This ${competitionDayCount}-day competition has ${maximumRemainderDays} Bonus ${maximumRemainderDays === 1 ? 'Day' : 'Days'} after day 28. Each verified Bonus Day is worth your ${days}-day goal before 10x.`;

  function selectWeeklyMatchResult(index: number, multiplier: WeeklyMatchMultiplier) {
    setWeeklyMatchMultipliers((current) =>
      current.map((value, currentIndex) =>
        currentIndex === index ? multiplier : value
      )
    );
    if (multiplier === 0) {
      setPerfectMonth(false);
    }
  }

  function confirmWeeklyGoal() {
    setWeeklyGoal(days);
    router.push('/entry-confirmed');
  }

  return (
    <ScreenContainer>
      <SponsorRail compact />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <OnboardingHeader
          label="COMMITMENT"
          onBack={() => goBackOrReplace(router, '/verification')}
          progress={100}
          step="STEP 05 / 05"
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CHOOSE YOUR WEEKLY GOAL
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Choose 1-7 verified days. The same goal repeats across four scoring
          weeks, and only one workout per calendar day counts.
        </TerminalText>

        {lateRegistrationActive ? (
          <View style={styles.lateGoalNotice}>
            <TerminalText glow tone="amber" variant="label">
              LATE REGISTRATION // DAY {lateRegistrationDay}
            </TerminalText>
            <TerminalText tone="muted" variant="caption">
              {`ONLY ${maximumSelectableGoal} ${maximumSelectableGoal === 1 ? 'DAY REMAINS' : 'DAYS REMAIN'} IN SCORING WEEK 1, SO YOUR GOAL IS LOCKED TO ${maximumSelectableGoal}. ALL OTHER GOALS ARE UNAVAILABLE. 3X IS AUTOMATIC IF YOUR MATCHED PLAYER MISSES BECAUSE NO EXTRA DAY EXISTS.`}
            </TerminalText>
          </View>
        ) : null}

        <View style={styles.selectedGoal}>
          <TerminalText tone="dim" variant="micro">
            YOUR COMMITMENT
          </TerminalText>
          <TerminalText glow style={styles.selectedGoalValue} tone="cyan" variant="display">
            {days}
          </TerminalText>
          <TerminalText tone="muted" variant="label">
            DAYS / WEEK
          </TerminalText>
        </View>

        <View accessibilityRole="radiogroup" style={styles.dayPicker}>
          {dayOptions.map((day) => {
            const available = availableGoalOptions.includes(day);

            return (
              <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: days === day,
                disabled: !available
              }}
              disabled={!available}
              key={day}
              onPress={() => setDays(day)}
              style={[
                styles.dayButton,
                !available
                  ? styles.dayButtonUnavailable
                  : days === day
                    ? styles.dayButtonActive
                    : styles.dayButtonIdle
              ]}
            >
              <TerminalText
                glow={days === day}
                tone={!available
                  ? 'muted'
                  : days === day
                    ? 'cyan'
                    : 'dim'}
                variant="value"
              >
                {day}
              </TerminalText>
              </Pressable>
            );
          })}
        </View>

        <CyberButtonPrimary
          label="CONFIRM WEEKLY GOAL ->"
          onPress={confirmWeeklyGoal}
          style={styles.topConfirmButton}
        />

        <HUDBorderBox style={styles.registrationStrip} tone="muted">
          <TerminalText tone="dim" variant="micro">
            NEXT REGIONAL COMPETITION
          </TerminalText>
          <TerminalText style={styles.registrationValue} tone="text" variant="body">
            {formatCampaignDate(upcomingCompetitionDates.startDateKey)} - {formatCampaignDate(upcomingCompetitionDates.endDateKey)}
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            REGISTRATION OPEN
          </TerminalText>
          <TerminalText style={styles.registrationPolicy} tone="dim" variant="micro">
            {enrollment.minimumEntrants} REGION MINIMUM // {sponsorCap}
          </TerminalText>
          <TerminalText style={styles.registrationPolicy} tone="muted" variant="caption">
            LATE REGISTRATION CLOSES AT 11:59 PM ON DAY 6.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.contestOverview} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            HOW THE COMPETITION WORKS
          </TerminalText>
          <ContestStep
            detail="Keep the same Weekly Goal for four scoring weeks."
            label="SET YOUR GOAL"
            number="01"
          />
          <ContestStep
            detail="Hit it each week. Miss it and that week earns 0 ENTRIES."
            label="SHOW UP AND VERIFY"
            number="02"
            warning="0 ENTRIES"
          />
          <ContestStep
            detail="A new Period Match appears each scoring week. Other bonuses appear when they become available."
            label="UNLOCK BONUSES"
            number="03"
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.baseProjection} tone="cyan">
          <View>
            <TerminalText tone="muted" variant="micro">
              YOUR FOUR-WEEK BASE
            </TerminalText>
            <TerminalText glow style={styles.baseProjectionValue} tone="cyan" variant="title">
              {days} X 4 = {baseMonthEntries} ENTRIES
            </TerminalText>
          </View>
          {!showCalculator ? (
            <TerminalText glow style={styles.bonusPrompt} tone="pink" variant="body">
              SEE HOW {baseMonthEntries} BASE ENTRIES COULD BECOME{' '}
              {maximumPotentialEntries.toLocaleString()} IN THIS {competitionDayCount}-DAY
              COMPETITION.
            </TerminalText>
          ) : null}
          <TerminalText tone="dim" uppercase={false} variant="caption">
            Open How Scoring Works to try each week&apos;s Period Match result, your category finish, Bonus Days 29-31 and the final Perfect Month 10x.
          </TerminalText>
          <CompactTextButton
            label={showCalculator ? 'HIDE HOW SCORING WORKS' : 'SEE HOW SCORING WORKS ->'}
            onPress={() => setShowCalculator((current) => !current)}
            tone={showCalculator ? 'muted' : 'cyan'}
          />
        </HUDBorderBox>

        {showCalculator ? (
        <HUDBorderBox glow style={styles.calculationPanel} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            HOW SCORING WORKS
          </TerminalText>
          <TerminalText style={styles.calculatorIntro} tone="muted" uppercase={false} variant="body">
            Choose a Weekly Goal, verify your workout days and hit the goal
            before each week closes. Miss the goal and that week earns 0
            Entries. Use the controls below to see how each result changes your total.
          </TerminalText>

          <View style={styles.resultPanel}>
            <TerminalText tone="muted" variant="label">
              LIVE PROJECTED TOTAL
            </TerminalText>
            <TerminalText glow style={styles.resultValue} tone="pink" variant="display">
              {projection.drawWeight.toLocaleString()}
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              PRIZE DRAW ENTRIES
            </TerminalText>
          </View>

          <WeeklyMatchControl
            days={days}
            multipliers={weeklyMatchMultipliers}
            onSelect={selectWeeklyMatchResult}
          />
          <ChoiceControl
            helper={`Finishing first, second or third in your commitment category multiplies the four-week Period Match subtotal by ${campaign.economics.categoryPodiumMultipliers[1]}x, ${campaign.economics.categoryPodiumMultipliers[2]}x or ${campaign.economics.categoryPodiumMultipliers[3]}x.`}
            label="2 // TOP THREE CATEGORY FINISHERS"
            onSelect={(value) => setCategoryRank(value as CategoryRank)}
            options={categoryOptions}
            selectedTone={(value) => value === 0 ? 'muted' : 'pink'}
            selectedValue={categoryRank}
          />

          <ChoiceControl
            helper={remainderHelper}
            label={maximumRemainderDays === 0
              ? '3 // NO BONUS DAYS'
              : `3 // BONUS DAYS 29-31 // ${maximumRemainderDays} AVAILABLE`}
            onSelect={(value) => setBonusDays(value as RemainderDayCount)}
            options={bonusDayOptions}
            selectedTone={(value) => value === 0 ? 'muted' : 'pink'}
            selectedValue={selectedBonusDays}
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <TerminalText glow tone="cyan" variant="label">
                4 // PERFECT MONTH
              </TerminalText>
              <TerminalText tone="muted" variant="caption">
                {perfectMonthAvailable
                  ? 'Apply the final 10x after Period Match, category and Bonus Day results.'
                  : 'Miss any Weekly Goal and the Perfect Month 10x is not available.'}
              </TerminalText>
            </View>
            <Switch
              accessibilityLabel="Perfect month 10x"
              disabled={!perfectMonthAvailable}
              onValueChange={setPerfectMonth}
              thumbColor={perfectMonth ? colors.pink : colors.dim}
              trackColor={{ false: colors.panelSoft, true: colors.surfacePinkActive }}
              value={perfectMonth && perfectMonthAvailable}
            />
          </View>

          <CompactTextButton
            label={showCalculation ? 'HIDE CALCULATION' : 'VIEW CALCULATION ->'}
            onPress={() => setShowCalculation((current) => !current)}
            tone={showCalculation ? 'muted' : 'cyan'}
          />

          {showCalculation ? (
            <View style={styles.calculationBreakdown}>
              <View style={styles.divider} />
              <TerminalText glow tone="cyan" variant="label">
                YOUR CALCULATION
              </TerminalText>
              <CalculationRow
                label="FOUR-WEEK BASE"
                value={`${days} X 4 = ${baseMonthEntries.toLocaleString()}`}
              />
              {weeklyMatchEntries.map((entries, index) => {
                const multiplier = weeklyMatchMultipliers[index];

                return (
                  <CalculationRow
                    key={`week-${index + 1}`}
                    label={`WEEK ${index + 1} // ${multiplier}X MATCH RESULT`}
                    tone={multiplier === 0 ? 'red' : multiplier === 3 ? 'pink' : 'cyan'}
                    value={`${days} X ${multiplier} = ${entries.toLocaleString()}`}
                  />
                );
              })}
              <CalculationRow
                label="PERIOD MATCH BONUS SUBTOTAL"
                value={`${weeklyMatchEntries.join(' + ')} = ${matchAdjustedEntries.toLocaleString()}`}
              />
              <CalculationRow
                label={categoryLabel}
                tone={categoryRank === 0 ? 'muted' : 'pink'}
                value={`${matchAdjustedEntries.toLocaleString()} X ${projection.multiplier} = ${projection.categoryAdjustedPeriodEntries.toLocaleString()}`}
              />
              <CalculationRow
                label={maximumRemainderDays === 0
                  ? 'NO BONUS DAYS'
                  : `BONUS DAY ENTRIES // ${selectedBonusDays} X ${days}`}
                tone={selectedBonusDays === 0 ? 'muted' : 'pink'}
                value={`${projection.categoryAdjustedPeriodEntries.toLocaleString()} + ${remainderDayEntries.toLocaleString()} = ${remainderAdjustedEntries.toLocaleString()}`}
              />
              <CalculationRow
                label={perfectMonth ? 'PERFECT MONTH' : 'PERFECT MONTH OFF'}
                tone={perfectMonth ? 'pink' : 'muted'}
                value={`${remainderAdjustedEntries.toLocaleString()} X ${perfectMonthMultiplier} = ${(remainderAdjustedEntries * perfectMonthMultiplier).toLocaleString()}`}
              />
            </View>
          ) : null}

          <TerminalText tone="dim" uppercase={false} variant="caption">
            Match results are added first, followed by category and Bonus Day
            Entries. Perfect Month 10x is applied last. Your Free Entry is added
            once without a multiplier.
          </TerminalText>
        </HUDBorderBox>
        ) : null}

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="CONFIRM WEEKLY GOAL ->"
            onPress={confirmWeeklyGoal}
          />
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function ContestStep({
  detail,
  label,
  number,
  warning
}: {
  detail: string;
  label: string;
  number: string;
  warning?: string;
}) {
  const detailParts = warning ? detail.split(warning) : [detail];

  return (
    <View style={styles.contestStep}>
      <TerminalText glow style={styles.contestStepNumber} tone="cyan" variant="label">
        {number}
      </TerminalText>
      <View style={styles.contestStepCopy}>
        <TerminalText style={styles.contestStepTitle} tone="text" variant="body">
          {label}
        </TerminalText>
        <TerminalText tone="muted" variant="caption">
          {detailParts[0]}
          {warning ? (
            <TerminalText glow tone="red" variant="caption">
              {warning}
            </TerminalText>
          ) : null}
          {detailParts[1] ?? ''}
        </TerminalText>
      </View>
    </View>
  );
}

function CalculationRow({
  helper,
  label,
  tone = 'cyan',
  value
}: {
  helper?: string;
  label: string;
  tone?: 'cyan' | 'pink' | 'red' | 'muted';
  value: string;
}) {
  return (
    <View style={styles.calculationRow}>
      <View style={styles.calculationLabel}>
        <TerminalText style={styles.calculationLabelText} tone="muted" variant="body">
          {label}
        </TerminalText>
        {helper ? (
          <TerminalText tone="dim" variant="caption">
            {helper}
          </TerminalText>
        ) : null}
      </View>
      <TerminalText glow style={styles.calculationValue} tone={tone} variant="body">
        {value}
      </TerminalText>
    </View>
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
      <TerminalText glow tone="cyan" variant="label">
        1 // PERIOD MATCH RESULTS
      </TerminalText>
      <TerminalText tone="dim" uppercase={false} variant="caption">
        Set each week separately. If you and your matched player both hit the goal,
        you earn 2x each. If they miss and you complete one extra verified workout,
        you earn 3x. When your goal uses every available day, 3x is automatic if
        they miss. Miss your own goal and that week earns 0 Entries.
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
                      tone={selected && option.value === 3 ? 'pink' : selected && option.value === 0 ? 'red' : selected ? 'cyan' : 'dim'}
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
  selectedValue,
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
      <TerminalText glow tone="cyan" variant="label">
        {label}
      </TerminalText>
      <View accessibilityRole="radiogroup" style={styles.segmentedControl}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          const activeTone = selectedTone?.(option.value) ?? 'cyan';

          return (
            <Pressable
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
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  contestOverview: {
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.lg
  },
  contestStep: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  contestStepNumber: {
    width: 24,
    paddingTop: 2
  },
  contestStepCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  contestStepTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  registrationStrip: {
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg
  },
  registrationValue: {
    marginVertical: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.button
  },
  registrationPolicy: {
    marginTop: spacing.xs
  },
  lateGoalNotice: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.statusWarning,
    backgroundColor: colors.surfaceWarning
  },
  selectedGoal: {
    alignItems: 'center',
    marginTop: spacing.md
  },
  selectedGoalValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displaySmall,
    lineHeight: 42
  },
  dayPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.md
  },
  topConfirmButton: {
    marginBottom: spacing.md
  },
  dayButton: {
    width: 39,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    ...interactionStates.webFocus
  },
  dayButtonActive: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  dayButtonIdle: {
    borderColor: colors.whiteAlpha08,
    backgroundColor: colors.surfaceBase
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
  baseProjection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  baseProjectionValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  bonusPrompt: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderPinkSubtle,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  calculatorIntro: {
    marginBottom: spacing.xs,
    fontFamily: fontFamilies.body
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
    backgroundColor: colors.surfaceInteractive
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
    borderRadius: 5,
    ...interactionStates.webFocus
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 8,
    backgroundColor: colors.surfaceInteractive
  },
  segment: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 5,
    ...interactionStates.webFocus
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
    borderColor: colors.divider
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs
  },
  calculationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  calculationLabel: {
    flex: 1,
    gap: 2
  },
  calculationLabelText: {
    fontFamily: fontFamilies.terminal
  },
  calculationBreakdown: {
    gap: spacing.sm
  },
  calculationValue: {
    flexShrink: 1,
    textAlign: 'right'
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider
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
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm
  }
});
