import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { creatorFeaturesEnabled } from '@/config/features';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { buildCalendarDays } from '@/domain/workoutProgress';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import { useCreatorWorkoutPlans } from '@/data/appDataHooks';
import { goBackOrReplace } from '@/navigation/goBack';
import {
  formatDateKey,
  formatMonthLabel,
  toDateKey,
  type CalendarDay,
  type WorkoutLog,
  useWorkoutProgress
} from '@/state/workoutProgress';

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export default function CalendarScreen() {
  const router = useRouter();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();
  const { width: viewportWidth } = useWindowDimensions();
  const compactCalendar = viewportWidth < 360;
  const {
    activeSession,
    addManualWorkoutLog,
    competition,
    currentStreak,
    currentWeekVerified,
    getLogsForDate,
    logs,
    weeklyGoal
  } = useWorkoutProgress();
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [showManualLogForm, setShowManualLogForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDuration, setManualDuration] = useState('45');
  const [manualExercises, setManualExercises] = useState('');
  const { data: creatorWorkoutPlans = [] } = useCreatorWorkoutPlans();

  const selectedLogs = useMemo(
    () => getLogsForDate(selectedDateKey),
    [getLogsForDate, selectedDateKey]
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(displayMonth, logs),
    [displayMonth, logs]
  );
  const selectedDateLabel = formatDateKey(selectedDateKey);
  const todayDateKey = toDateKey(new Date());
  const selectedPlans = creatorWorkoutPlans.filter(({ plannedDate }) => plannedDate === selectedDateKey);
  const plannedDateKeys = useMemo(
    () => new Set(creatorWorkoutPlans.map(({ plannedDate }) => plannedDate)),
    [creatorWorkoutPlans]
  );
  const monthLabel = formatMonthLabel(displayMonth);
  const manualDurationMinutes = Number.parseInt(manualDuration, 10);
  const selectedDateIsFuture = selectedDateKey > todayDateKey;
  const selectedDateIsToday = selectedDateKey === todayDateKey;
  const selectedDateIsPast = selectedDateKey < todayDateKey;
  const manualLogIsValid =
    !selectedDateIsFuture &&
    Number.isFinite(manualDurationMinutes) &&
    manualDurationMinutes > 0;
  const competitionNotStarted = competition.phase === 'before-month';

  function saveManualLog() {
    if (!manualLogIsValid) {
      return;
    }

    addManualWorkoutLog({
      dateKey: selectedDateKey,
      durationMinutes: Number.isFinite(manualDurationMinutes)
        ? manualDurationMinutes
        : 45,
      exercises: manualExercises,
      title: manualTitle
    });
    setManualTitle('');
    setManualDuration('45');
    setManualExercises('');
    setShowManualLogForm(false);
  }

  function changeMonth(offset: number) {
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
    const today = new Date();
    const nextDateKey =
      nextMonth.getFullYear() === today.getFullYear() &&
      nextMonth.getMonth() === today.getMonth()
        ? toDateKey(today)
        : toDateKey(nextMonth);

    setDisplayMonth(nextMonth);
    setSelectedDateKey(nextDateKey);
    setShowManualLogForm(false);
  }

  function goToToday() {
    const today = new Date();
    setDisplayMonth(startOfMonth(today));
    setSelectedDateKey(toDateKey(today));
    setShowManualLogForm(false);
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="WORKOUT CALENDAR"
          onBack={() => goBackOrReplace(router, '/home')}
          step="PERSONAL + VERIFIED HISTORY"
        />

        {activeSession ? (
          <HUDBorderBox style={styles.activeSyncCard} tone="cyan">
            <TerminalText tone="cyan" variant="micro">
              SESSION IN PROGRESS
            </TerminalText>
            <TerminalText style={styles.activeSyncCopy} tone="muted" uppercase={false} variant="body">
              Today will check off automatically when workout verification
              finishes.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <View style={styles.statRow}>
          <StatCard
            label={competitionNotStarted ? 'VERIFIED BEFORE START' : 'ACHIEVED THIS WEEK'}
            tone="cyan"
            value={`${Math.min(currentWeekVerified, weeklyGoal)} OF ${weeklyGoal}`}
          />
          <StatCard label="PERSONAL STREAK" tone="green" value={String(currentStreak)} />
        </View>

        <HUDBorderBox style={styles.primaryActionCard} tone="cyan">
          <View style={styles.primaryActionCopy}>
            <TerminalText tone="cyan" variant="micro">
              SELECTED // {selectedDateIsToday ? 'TODAY' : selectedDateIsFuture ? 'UPCOMING' : 'PAST'}
            </TerminalText>
            <TerminalText tone="text" uppercase={false} variant="body">
              {selectedDateLabel}
            </TerminalText>
          </View>
          {selectedDateIsFuture && creatorFeaturesEnabled ? (
            <CyberButtonPrimary
              label="PLAN A CREATOR WORKOUT ->"
              onPress={() => router.push(
                `/workouts?source=calendar&plannedDate=${selectedDateKey}` as Href
              )}
              tone="amber"
            />
          ) : !selectedDateIsFuture && selectedDateIsPast ? (
            <CyberButtonPrimary
              label="RETURN TO TODAY TO START ->"
              onPress={goToToday}
            />
          ) : !selectedDateIsFuture && mobileGymVerificationAvailable ? (
            <CyberButtonPrimary
              label="START TODAY'S VERIFIED WORKOUT ->"
              onPress={() => router.push('/session' as Href)}
            />
          ) : null}
        </HUDBorderBox>

        <HUDBorderBox style={styles.calendarCard} tone="cyan">
          <View style={styles.calendarHeader}>
            <View style={styles.monthControls}>
              <Pressable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                onPress={() => changeMonth(-1)}
                style={({ pressed }) => [styles.monthButton, pressed ? styles.pressed : null]}
              >
                <TerminalText tone="cyan" uppercase={false} variant="button">
                  {'←'}
                </TerminalText>
              </Pressable>
              <TerminalText style={styles.monthLabel} tone="cyan" variant="label">
                {monthLabel}
              </TerminalText>
              <Pressable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                onPress={() => changeMonth(1)}
                style={({ pressed }) => [styles.monthButton, pressed ? styles.pressed : null]}
              >
                <TerminalText tone="cyan" uppercase={false} variant="button">
                  {'→'}
                </TerminalText>
              </Pressable>
            </View>
            <Pressable
              accessibilityLabel="Return to today"
              accessibilityRole="button"
              onPress={goToToday}
              style={({ pressed }) => [
                styles.todayButton,
                selectedDateIsToday ? styles.todayButtonSelected : null,
                pressed ? styles.pressed : null
              ]}
            >
              <TerminalText
                glow={selectedDateIsToday}
                tone={selectedDateIsToday ? 'cyan' : 'dim'}
                variant="micro"
              >
                TODAY
              </TerminalText>
            </Pressable>
            <TerminalText style={styles.calendarStatus} tone="dim" uppercase={false} variant="micro">
              {competitionNotStarted
                ? 'Verified workouts build your history until Contest scoring opens.'
                : 'Verified workouts can earn Contest credit.'}
            </TerminalText>
          </View>

          <View style={styles.legend}>
            <CalendarLegend color={colors.green} label="VERIFIED" />
            <CalendarLegend color={colors.dim} label="PERSONAL" />
            <CalendarLegend color={colors.pink} label="BONUS DAY" />
            <CalendarLegend color={colors.amber} label="PLANNED" />
          </View>

          <View style={[styles.weekdayRow, compactCalendar ? styles.calendarGridCompact : null]}>
            {weekdayLabels.map((label, index) => (
              <TerminalText
                key={`${label}-${index}`}
                style={styles.weekdayLabel}
                tone="dim"
                variant="micro"
              >
                {label}
              </TerminalText>
            ))}
          </View>

          <View style={[styles.calendarGrid, compactCalendar ? styles.calendarGridCompact : null]}>
            {calendarDays.map((day) => (
              <CalendarDayCell
                compact={compactCalendar}
                day={day}
                key={day.dateKey}
                onPress={() => {
                  setSelectedDateKey(day.dateKey);
                  setShowManualLogForm(false);
                }}
                selected={day.dateKey === selectedDateKey}
                planned={plannedDateKeys.has(day.dateKey)}
              />
            ))}
          </View>
        </HUDBorderBox>

        <HUDBorderBox style={styles.detailCard} tone="muted">
          <View style={styles.detailHeader}>
            <View>
              <TerminalText tone="dim" variant="micro">
                SELECTED DAY
              </TerminalText>
              <TerminalText style={styles.detailDate} tone="text" variant="body">
                {selectedDateLabel}
              </TerminalText>
            </View>
            <TerminalText
              glow
              tone={selectedDateIsToday ? 'cyan' : selectedDateIsFuture ? 'amber' : 'dim'}
              variant="label"
            >
              {selectedDateIsToday ? 'TODAY' : selectedDateIsFuture ? 'UPCOMING' : 'PAST'}
            </TerminalText>
          </View>

          {selectedLogs.length > 0 ? (
            <View style={styles.logList}>
              {selectedLogs.map((log) => (
                <WorkoutLogRow key={log.id} log={log} />
              ))}
            </View>
          ) : (
            <HUDBorderBox style={styles.emptyLogCard} tone="muted">
              <TerminalText style={styles.emptyLogText} tone="muted" uppercase={false} variant="body">
                No workout logged for this date yet.
              </TerminalText>
            </HUDBorderBox>
          )}

          {selectedPlans.length > 0 ? (
            <View style={styles.planList}>
              <TerminalText glow tone="amber" variant="micro">
                PLANNED CREATOR WORKOUTS
              </TerminalText>
              {selectedPlans.map((plan) => (
                <HUDBorderBox key={plan.id} style={styles.planRow} tone="amber">
                  <View style={styles.planCopy}>
                    <TerminalText tone="text" variant="body">{plan.workoutName}</TerminalText>
                    <TerminalText tone="muted" uppercase={false} variant="caption">
                      {plan.creatorName} · {plan.workoutStyle}
                    </TerminalText>
                  </View>
                  <TerminalText glow tone="amber" variant="label">{plan.durationMinutes} MIN</TerminalText>
                </HUDBorderBox>
              ))}
              <TerminalText tone="dim" uppercase={false} variant="caption">
                Planned videos are scheduling aids only. Start a Verified workout when you train.
              </TerminalText>
            </View>
          ) : null}
        </HUDBorderBox>

        <TerminalText style={styles.actionHint} tone="dim" uppercase={false} variant="caption">
          {selectedDateIsFuture
            ? creatorFeaturesEnabled
              ? 'Plan a Creator workout for this day. Verified workouts count on the day you complete them.'
              : 'Return on this day to start your own Verified workout.'
            : selectedDateIsPast
              ? 'Add a personal log for this day, or return to today to start a Verified workout.'
              : 'Personal logs track your history only. Start a Verified workout below for Contest credit.'}
        </TerminalText>
        <CyberButtonOutline
          disabled={selectedDateIsFuture}
          label={showManualLogForm ? 'CANCEL PERSONAL LOG' : 'LOG PERSONAL WORKOUT'}
          onPress={() => setShowManualLogForm((current) => !current)}
          style={styles.manualToggle}
        />

        {showManualLogForm ? <HUDBorderBox style={styles.manualCard} tone="cyan">
          <View style={styles.manualHeader}>
            <View style={styles.manualHeaderCopy}>
              <TerminalText glow tone="cyan" variant="label">
                PERSONAL WORKOUT LOG
              </TerminalText>
              <TerminalText style={styles.manualDate} tone="text" variant="body">
                {selectedDateLabel}
              </TerminalText>
            </View>
            <TerminalText tone="dim" variant="micro">
              TRACKING ONLY
            </TerminalText>
          </View>
          <TerminalText style={styles.manualHelp} tone="muted" uppercase={false} variant="body">
            {selectedDateIsFuture
              ? 'Future workouts cannot be logged. Choose today or an earlier date.'
              : 'Save a private record of your workout. Add a name, duration, exercises, sets or any notes you want to remember.'}
          </TerminalText>

          {!selectedDateIsFuture ? (
            <HUDBorderBox style={styles.manualNotice} tone="muted">
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Manual logs mark this calendar only. They do not verify a workout or
                change your Weekly Goal, Goal Score or Prize Draw Entries.
              </TerminalText>
            </HUDBorderBox>
          ) : null}

          <TerminalText style={styles.inputLabel} tone="dim" variant="micro">
            WORKOUT NAME // OPTIONAL
          </TerminalText>
          <TextInput
            allowFontScaling
            maxFontSizeMultiplier={2}
            accessibilityLabel="Workout name"
            autoCapitalize="sentences"
            maxLength={60}
            onChangeText={setManualTitle}
            placeholder="Example: Upper body strength"
            placeholderTextColor={colors.dim}
            style={styles.input}
            value={manualTitle}
          />

          <TerminalText style={styles.inputLabel} tone="dim" variant="micro">
            DURATION // MINUTES
          </TerminalText>
          <TextInput
            allowFontScaling
            maxFontSizeMultiplier={2}
            accessibilityLabel="Workout duration in minutes"
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setManualDuration}
            placeholder="45"
            placeholderTextColor={colors.dim}
            style={styles.input}
            value={manualDuration}
          />

          <TerminalText style={styles.inputLabel} tone="dim" variant="micro">
            EXERCISES, SETS + NOTES // OPTIONAL
          </TerminalText>
          <TextInput
            allowFontScaling
            maxFontSizeMultiplier={2}
            accessibilityLabel="Exercises, sets and workout notes"
            maxLength={500}
            multiline
            onChangeText={setManualExercises}
            placeholder={'Example:\nBench press - 3 x 8\nCable row - 3 x 10\nFelt strong today'}
            placeholderTextColor={colors.dim}
            style={[styles.input, styles.notesInput]}
            value={manualExercises}
          />

          <CyberButtonPrimary
            disabled={!manualLogIsValid}
            label="SAVE PERSONAL LOG ->"
            onPress={saveManualLog}
            style={styles.saveButton}
          />
        </HUDBorderBox> : null}

      </ScreenScrollView>
    </ScreenContainer>
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function CalendarLegend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <TerminalText tone="dim" variant="micro">
        {label}
      </TerminalText>
    </View>
  );
}

function StatCard({
  label,
  tone,
  value
}: {
  label: string;
  tone: 'cyan' | 'green' | 'pink';
  value: string;
}) {
  return (
    <HUDBorderBox style={styles.statCard} tone="muted">
      <TerminalText glow style={styles.statValue} tone={tone} variant="value">
        {value}
      </TerminalText>
      <TerminalText style={styles.statLabel} tone="muted" variant="micro">
        {label}
      </TerminalText>
    </HUDBorderBox>
  );
}

function CalendarDayCell({
  compact,
  day,
  onPress,
  planned,
  selected
}: {
  compact: boolean;
  day: CalendarDay;
  onPress: () => void;
  planned: boolean;
  selected: boolean;
}) {
  const hasWorkout = day.status !== 'empty';
  const isVerified = day.status === 'verified';

  return (
    <Pressable
      accessibilityLabel={`${formatDateKey(day.dateKey)}. ${day.status === 'verified' ? 'Verified workout' : day.status === 'manual' ? 'Manual workout logged' : 'No workout logged'}${planned ? '. Creator workout planned' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayCell,
        compact ? styles.dayCellCompact : null,
        !day.inCurrentMonth ? styles.dayCellMuted : null,
        day.isToday ? styles.dayCellToday : null,
        hasWorkout ? styles.dayCellChecked : null,
        isVerified ? styles.dayCellVerified : null,
        planned && !isVerified ? styles.dayCellPlanned : null,
        selected ? styles.dayCellSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText
        glow={hasWorkout || selected}
        style={styles.dayNumber}
        tone={selected ? 'cyan' : isVerified ? 'green' : hasWorkout ? 'text' : 'muted'}
        variant="body"
      >
        {day.dayNumber}
      </TerminalText>
      {hasWorkout ? (
        <TerminalText glow={isVerified} tone={isVerified ? 'green' : 'dim'} variant="micro">
          {isVerified ? 'OK' : 'LOG'}
        </TerminalText>
      ) : planned ? (
        <TerminalText glow tone="amber" variant="micro">PLAN</TerminalText>
      ) : null}
    </Pressable>
  );
}

function WorkoutLogRow({ log }: { log: WorkoutLog }) {
  const isVerified = log.source === 'verified';

  return (
    <HUDBorderBox style={styles.logRow} tone={isVerified ? 'green' : 'muted'}>
      <View style={styles.logHeader}>
        <View style={styles.logCopy}>
          <TerminalText glow={isVerified} tone={isVerified ? 'green' : 'text'} variant="body">
            {log.title}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {log.exercises}
          </TerminalText>
        </View>
        <View style={styles.logMeta}>
          <TerminalText glow={isVerified} tone={isVerified ? 'green' : 'muted'} variant="label">
            {log.durationMinutes}
          </TerminalText>
          <TerminalText tone="dim" variant="micro">
            MIN
          </TerminalText>
        </View>
      </View>
      <View style={styles.logFooter}>
        <TerminalText tone="dim" variant="micro">
          {isVerified ? 'VERIFIED WORKOUT' : 'MANUAL LOG'}
        </TerminalText>
        <TerminalText
          glow={isVerified}
          tone={isVerified && log.entriesEarned > 0 ? 'pink' : isVerified ? 'green' : 'dim'}
          variant="micro"
        >
          {isVerified
            ? log.entriesEarned > 0
              ? `+${log.entriesEarned} BONUS DAY ${log.entriesEarned === 1 ? 'ENTRY' : 'ENTRIES'}`
              : 'WEEKLY CREDIT'
            : 'TRACKING ONLY'}
        </TerminalText>
      </View>
    </HUDBorderBox>
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
  streakBadge: {
    width: 116,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  streakBadgeCompact: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  streakValue: {
    fontFamily: fontFamilies.display
  },
  activeSyncCard: {
    marginBottom: spacing.md,
    padding: spacing.md
  },
  activeSyncCopy: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md
  },
  primaryActionCard: {
    gap: spacing.md,
    padding: spacing.md
  },
  primaryActionCopy: {
    gap: spacing.xs
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 28
  },
  statLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  calendarCard: {
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  calendarHeader: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  monthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center'
  },
  todayButton: {
    minHeight: 44,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  todayButtonSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  calendarStatus: {
    textAlign: 'center'
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm
  },
  weekdayLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  calendarGridCompact: {
    width: 308,
    alignSelf: 'center'
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 46,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  dayCellCompact: {
    width: 44,
    minHeight: 48
  },
  dayCellMuted: {
    opacity: 0.42
  },
  dayCellToday: {
    borderColor: colors.borderCyanHeavy
  },
  dayCellChecked: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  dayCellVerified: {
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess,
    ...cyberGlow.green
  },
  dayCellPlanned: {
    borderColor: colors.amber,
    backgroundColor: colors.surfaceWarning
  },
  dayCellSelected: {
    borderColor: colors.borderCyanGlow,
    backgroundColor: colors.surfaceCyanStrong
  },
  dayNumber: {
    fontFamily: fontFamilies.display
  },
  detailCard: {
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  planList: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md
  },
  planCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  detailDate: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  logList: {
    gap: spacing.sm
  },
  logRow: {
    padding: spacing.md
  },
  logHeader: {
    flexDirection: 'row',
    gap: spacing.md
  },
  logCopy: {
    flex: 1
  },
  logMeta: {
    alignItems: 'flex-end'
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.whiteAlpha06
  },
  emptyLogCard: {
    padding: spacing.md
  },
  emptyLogText: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  manualCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  manualToggle: {
    marginBottom: spacing.md
  },
  actionHint: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    textAlign: 'center'
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  manualHeaderCopy: {
    flex: 1
  },
  manualDate: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  manualHelp: {
    fontFamily: fontFamilies.body
  },
  manualNotice: {
    marginVertical: spacing.xs,
    padding: spacing.md
  },
  inputLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  input: {
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderCyanSoft,
    borderRadius: radii.sm,
    color: colors.text,
    backgroundColor: colors.panelAlpha70,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body
  },
  notesInput: {
    minHeight: 132,
    textAlignVertical: 'top'
  },
  saveButton: {
    minHeight: 48,
    paddingVertical: spacing.md
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
