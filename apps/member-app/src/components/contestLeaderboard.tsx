import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { HUDBorderBox, TerminalText } from '@/components/cyber';
import { RecoverableError } from '@/components/reliability';
import { UserAlias } from '@/components/streakRewards';
import { resolveCategoryPodiumMultipliers } from '@/config/competition';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import type { CategoryLeaderboardRow } from '@/data/appData';
import { useCategoryLeaderboard } from '@/data/appDataHooks';
import { type GoalCategory } from '@/domain/campaignEconomics';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useWorkoutProgress } from '@/state/workoutProgress';

const goalCategories = [
  1, 2, 3, 4, 5, 6, 7
] as const satisfies readonly GoalCategory[];

export function ContestLeaderboard() {
  const { width: viewportWidth } = useWindowDimensions();
  const compactRankings = viewportWidth < 360;
  const { user } = useAuth();
  const { currentCompetition } = useSessionRegistrationAccess();
  const { competition, weeklyGoal } = useWorkoutProgress();
  const podiumMultipliers = resolveCategoryPodiumMultipliers(
    currentCompetition?.rules
  );
  const [selectedGoal, setSelectedGoal] = useScreenMemory<GoalCategory | null>(
    'leaderboard-winners:selected-goal',
    null
  );
  const [showCategoryPicker, setShowCategoryPicker] = useScreenMemory(
    'leaderboard-winners:category-picker',
    false
  );
  const displayedGoal = selectedGoal ?? (weeklyGoal as GoalCategory);
  const leaderboardQuery = useCategoryLeaderboard(displayedGoal);
  const leaderboardRows = Array.isArray(leaderboardQuery.data?.rows)
    ? leaderboardQuery.data.rows.slice(0, 10)
    : [];
  const competitionNotStarted = competition.phase === 'before-month';

  return (
    <View>
      <View style={styles.sectionHeader}>
        <TerminalText glow tone="cyan" variant="label">
          LEADERBOARD
        </TerminalText>
        <TerminalText tone="muted" uppercase={false} variant="caption">
          Server-authoritative {leaderboardQuery.data?.scoringStatus ?? 'provisional'} leaders in each Weekly Goal group.
        </TerminalText>
      </View>

      <View style={styles.categorySection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showCategoryPicker }}
          onPress={() => setShowCategoryPicker((current) => !current)}
          style={({ pressed }) => [
            styles.categoryPickerButton,
            pressed ? styles.pressed : null
          ]}
        >
          <View style={styles.categoryPickerCopy}>
            <TerminalText tone="dim" variant="micro">
              WEEKLY GOAL GROUP
            </TerminalText>
            <TerminalText glow tone="cyan" variant="body">
              {displayedGoal}-DAY WEEKLY GOAL
            </TerminalText>
          </View>
          <TerminalText glow tone="cyan" variant="micro">
            {showCategoryPicker ? 'CLOSE' : 'CHANGE'}
          </TerminalText>
        </Pressable>
        {showCategoryPicker ? (
          <View accessibilityRole="radiogroup" style={styles.categorySelector}>
            {goalCategories.map((goal) => {
              const selected = goal === displayedGoal;

              return (
                <Pressable
                  aria-checked={selected}
                  accessibilityLabel={`${goal}-day Weekly Goal group`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={goal}
                  onPress={() => {
                    setSelectedGoal(goal);
                    setShowCategoryPicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.categoryOption,
                    selected ? styles.categoryOptionSelected : null,
                    pressed ? styles.pressed : null
                  ]}
                >
                  <TerminalText
                    glow={selected}
                    tone={selected ? 'cyan' : 'dim'}
                    variant="button"
                  >
                    {goal}
                  </TerminalText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <HUDBorderBox style={styles.topTenPanel} tone="cyan">
        <View style={styles.topTenHeader}>
          <View style={styles.topTenHeading}>
            <TerminalText tone="cyan" variant="label">
              TOP 10{' // '}
              {displayedGoal}-DAY GOAL
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              {leaderboardQuery.data?.scoringStatus === 'final'
                ? 'Final top three earned 3x, 2x and 1.5x entry boosts.'
                : 'Current top three project 3x, 2x and 1.5x boosts; placement is not banked.'}
            </TerminalText>
          </View>
          <TerminalText tone="dim" variant="micro">
            {leaderboardQuery.data?.scoringStatus === 'final' ? 'FINAL SCORE' : 'PROVISIONAL SCORE'}
          </TerminalText>
        </View>

        <View style={styles.topTenList}>
          {leaderboardQuery.isError ? (
            <RecoverableError
              body="The current Goal group could not be loaded. Your saved goal and rank are unchanged."
              onRetry={() => {
                void recordFlowMetric(user?.uid, 'flow-retry', 'leaderboard');
                void leaderboardQuery.refetch();
              }}
              retrying={leaderboardQuery.isFetching}
              title="COULD NOT LOAD STANDINGS"
            />
          ) : null}
          {leaderboardRows.map((row) => (
            <LeaderboardResultRow
              compact={compactRankings}
              isCurrentUser={row.isCurrentUser}
              key={`${row.rank}:${row.alias}`}
              multiplier={
                row.rank <= 3
                  ? podiumMultipliers[row.rank as 1 | 2 | 3]
                  : undefined
              }
              row={row}
            />
          ))}
          {!leaderboardQuery.isError &&
          !leaderboardQuery.isPending &&
          leaderboardRows.length === 0 ? (
            <HUDBorderBox style={styles.emptyStandings} tone="muted">
              <TerminalText glow tone="amber" variant="label">
                {competitionNotStarted
                  ? 'LEADERBOARD OPENS WITH SCORING'
                  : 'STANDINGS NOT AVAILABLE YET'}
              </TerminalText>
              <TerminalText
                style={styles.emptyStandingsCopy}
                tone="muted"
                uppercase={false}
                variant="body"
              >
                Live results will appear when this month&apos;s contest data is
                ready.
              </TerminalText>
            </HUDBorderBox>
          ) : null}
          {!leaderboardQuery.isError && leaderboardQuery.isPending ? (
            <TerminalText
              live="polite"
              style={styles.loading}
              tone="muted"
              variant="label"
            >
              LOADING LEADERBOARD...
            </TerminalText>
          ) : null}
        </View>
      </HUDBorderBox>
    </View>
  );
}

export function LeaderboardResultRow({
  compact = false,
  isCurrentUser,
  multiplier,
  row
}: {
  compact?: boolean;
  isCurrentUser: boolean;
  multiplier?: number;
  row: CategoryLeaderboardRow;
}) {
  return (
    <View
      style={[
        styles.resultRow,
        compact ? styles.resultRowCompact : null,
        isCurrentUser ? styles.currentUserRow : null
      ]}
    >
      <TerminalText
        glow={row.rank <= 3}
        style={styles.rankText}
        tone={row.rank <= 3 ? 'cyan' : 'muted'}
        variant="label"
      >
        {String(row.rank).padStart(2, '0')}
      </TerminalText>
      <View style={styles.resultCopy}>
        <UserAlias
          alias={row.alias}
          streaks={row.streaks}
          style={[
            styles.resultIdentity,
            compact ? styles.resultIdentityCompact : null
          ]}
          textStyle={styles.resultName}
        />
        {isCurrentUser ? (
          <TerminalText tone="cyan" variant="micro">
            YOU
          </TerminalText>
        ) : null}
      </View>
      {multiplier ? (
        <View style={styles.multiplierBadge}>
          <TerminalText glow tone="pink" variant="micro">
            {multiplier}X
          </TerminalText>
        </View>
      ) : null}
      <TerminalText
        glow={row.rank <= 3}
        style={styles.resultScore}
        tone="cyan"
        variant="body"
      >
        {row.categoryEntries}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  categorySection: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  categoryPickerButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    borderRadius: 8,
    backgroundColor: colors.panelAlpha70
  },
  categoryPickerCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 8,
    backgroundColor: colors.panelAlpha70
  },
  categoryOption: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5
  },
  categoryOptionSelected: {
    backgroundColor: colors.surfaceCyanActive
  },
  topTenPanel: {
    gap: spacing.md,
    padding: spacing.lg
  },
  topTenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md
  },
  topTenHeading: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  topTenList: {
    borderTopWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  emptyStandings: {
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.lg
  },
  emptyStandingsCopy: {
    fontFamily: fontFamilies.body
  },
  loading: {
    paddingVertical: spacing.xl,
    textAlign: 'center'
  },
  resultRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  resultRowCompact: {
    minHeight: 72
  },
  currentUserRow: {
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    backgroundColor: colors.surfaceCyanFaint
  },
  rankText: {
    width: 28,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  resultCopy: {
    minWidth: 0,
    flex: 1
  },
  resultIdentity: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  resultIdentityCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2
  },
  resultName: {
    flexShrink: 1,
    fontFamily: fontFamilies.bodyStrong
  },
  multiplierBadge: {
    minWidth: 34,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderPinkSubtle,
    borderRadius: 4,
    backgroundColor: colors.surfacePinkFaint
  },
  resultScore: {
    width: 52,
    fontFamily: fontFamilies.display,
    textAlign: 'right'
  },
  pressed: {
    opacity: 0.72
  }
});
