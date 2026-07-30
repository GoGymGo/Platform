import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  ScreenScrollView,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { InlineHelpButton } from '@/components/clarity';
import { CompetitionHubNav } from '@/components/competitionHubNav';
import { CompactTextButton } from '@/components/onboarding';
import { RecoverableError } from '@/components/reliability';
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import type { CategoryLeaderboardRow } from '@/data/appData';
import { useCategoryLeaderboard, useMyStreaks } from '@/data/appDataHooks';
import { type GoalCategory } from '@/domain/campaignEconomics';
import { getCompetitionRankLabel } from '@/domain/competition';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useProfile } from '@/state/profile';
import { useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

const goalCategories = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly GoalCategory[];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const compactRankings = viewportWidth < 360;
  const { user } = useAuth();
  const { publicName } = useProfile();
  const { campaign } = useSponsorCampaign();
  const {
    competition,
    currentWeekVerified,
    totalEntries,
    weeklyGoal
  } = useWorkoutProgress();
  const [selectedGoal, setSelectedGoal] = useScreenMemory<GoalCategory | null>(
    'leaderboard:selected-goal',
    null
  );
  const [showCategoryPicker, setShowCategoryPicker] = useScreenMemory(
    'leaderboard:category-picker',
    false
  );
  const [showRankingRules, setShowRankingRules] = useScreenMemory(
    'leaderboard:ranking-rules',
    false
  );
  const displayedGoal = selectedGoal ?? (weeklyGoal as GoalCategory);
  const selectedLeaderboardQuery = useCategoryLeaderboard(displayedGoal);
  const {
    data: selectedLeaderboard,
    isPending: leaderboardPending
  } = selectedLeaderboardQuery;
  const { data: myGoalLeaderboard } =
    useCategoryLeaderboard(weeklyGoal as GoalCategory);
  const { data: streakSummary } = useMyStreaks();
  const competitionNotStarted = competition.phase === 'before-month';
  const hasSettledWeek = competition.periodResults.some((period) => period.status === 'settled');
  const categoryScore = competition.periodEntriesBeforePerfectMonth;
  const standingsVisible = !competitionNotStarted;
  const myRank = myGoalLeaderboard?.rows.find(
    ({ alias }) => alias.toLowerCase() === publicName.toLowerCase()
  )?.rank;
  const currentRankLabel = getCompetitionRankLabel({
    competitionNotStarted,
    hasSettledWeek,
    rank: myRank
  });
  const challengeStatus = competitionNotStarted
    ? 'NOT STARTED'
    : competition.phase === 'bonus-days'
      ? 'COMPLETE'
      : competition.currentPeriod?.availability === 'matched'
        ? 'IN PROGRESS'
        : 'PAIRING NEEDED';

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey="leaderboard"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <View style={styles.header}>
          <View style={styles.headerTopLine}>
            <TerminalText glow tone="cyan" variant="label">
              {campaign.region}{' // MONTHLY COMPETITION'}
            </TerminalText>
            <InlineHelpButton
              label="Open competition guide"
              onPress={() => router.push('/how-it-works?from=leaderboard')}
            />
          </View>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            REGIONAL COMPETITION
          </TerminalText>
          <TerminalText style={styles.intro} tone="muted" uppercase={false} variant="body">
            Track your standing, Prize Draw Entries and Weekly Challenge.
          </TerminalText>
        </View>

        <CompetitionHubNav active="rankings" style={styles.hubNav} />

        <HUDBorderBox glow style={styles.myStandingCard} tone="cyan">
          <View style={styles.standingHeader}>
            <View style={styles.standingIdentity}>
              <TerminalText tone="dim" variant="label">
                YOUR MONTH
              </TerminalText>
              <UserAlias
                alias={publicName}
                streaks={streakSummary?.streaks}
                textStyle={styles.myName}
                uppercase={false}
              />
            </View>
            <TerminalText glow tone="cyan" variant="label">
              {weeklyGoal}-DAY GOAL GROUP
            </TerminalText>
          </View>
          <View style={styles.overviewGrid}>
            <OverviewMetric
              label="CURRENT RANK"
              tone="cyan"
              value={currentRankLabel}
            />
            <OverviewMetric
              label="WEEKLY GOAL"
              tone="green"
              value={`${Math.min(currentWeekVerified, weeklyGoal)}/${weeklyGoal}`}
            />
            <OverviewMetric
              label="PRIZE DRAW ENTRIES"
              tone="pink"
              value={String(totalEntries)}
            />
            <OverviewMetric
              label="WEEKLY CHALLENGE"
              tone={challengeStatus === 'PAIRING NEEDED' ? 'amber' : 'cyan'}
              value={challengeStatus}
            />
          </View>
          <TerminalText live="polite" tone="dim" uppercase={false} variant="caption">
            {competitionNotStarted
              ? 'Rankings begin after the first scoring week.'
              : `Goal Score ${categoryScore} sets your rank after each completed week. Prize Draw Entries set your winning odds.`}
          </TerminalText>
          <CompactTextButton
            label={showRankingRules ? 'Hide ranking details' : 'How ranking works'}
            onPress={() => setShowRankingRules((current) => !current)}
            tone={showRankingRules ? 'muted' : 'cyan'}
          />
          {showRankingRules ? (
            <View style={styles.rankingRules}>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Goal Score includes each settled week&apos;s 1x, 2x or 3x Weekly
                Challenge result. Equal scores are resolved by verified
                competition days, then the published audited tie-break.
              </TerminalText>
            </View>
          ) : null}
        </HUDBorderBox>

        {standingsVisible ? <>
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
                    <TerminalText glow={selected} tone={selected ? 'cyan' : 'dim'} variant="button">
                      {goal}
                    </TerminalText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <HUDBorderBox glow style={styles.topTenPanel} tone="cyan">
          <View style={styles.topTenHeader}>
            <View style={styles.topTenHeading}>
              <TerminalText glow tone="cyan" variant="label">
                TOP 10{' // '}{displayedGoal}-DAY GOAL
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Top three finishers receive 3x, 2x and 1.5x Prize Draw Entry boosts.
              </TerminalText>
            </View>
            <TerminalText tone="dim" variant="micro">
              GOAL SCORE
            </TerminalText>
          </View>

          <View style={styles.topTenList}>
            {selectedLeaderboardQuery.isError ? (
              <RecoverableError
                body="The current Goal group could not be loaded. Your saved goal and rank are unchanged."
                onRetry={() => {
                  void recordFlowMetric(user?.uid, 'flow-retry', 'leaderboard');
                  void selectedLeaderboardQuery.refetch();
                }}
                retrying={selectedLeaderboardQuery.isFetching}
                title="COULD NOT LOAD STANDINGS"
              />
            ) : null}
            {selectedLeaderboard?.rows.map((row) => (
              <LeaderboardResultRow
                compact={compactRankings}
                isCurrentUser={row.alias.toLowerCase() === publicName.toLowerCase()}
                key={row.rank}
                multiplier={row.rank <= 3
                  ? campaign.economics.categoryPodiumMultipliers[row.rank as 1 | 2 | 3]
                  : undefined}
                row={row}
              />
            ))}
            {!selectedLeaderboardQuery.isError && !leaderboardPending && !selectedLeaderboard ? (
              <HUDBorderBox style={styles.emptyStandings} tone="muted">
                <TerminalText glow tone="amber" variant="label">
                  STANDINGS NOT AVAILABLE YET
                </TerminalText>
                <TerminalText style={styles.emptyStandingsCopy} tone="muted" uppercase={false} variant="body">
                  Live results will appear when this month&apos;s competition data is ready.
                </TerminalText>
              </HUDBorderBox>
            ) : null}
          </View>

        </HUDBorderBox>
        </> : null}

      </ScreenScrollView>
    </ScreenContainer>
  );
}

function OverviewMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: 'amber' | 'cyan' | 'green' | 'pink';
  value: string;
}) {
  return (
    <View style={styles.overviewMetric}>
      <TerminalText glow style={styles.overviewValue} tone={tone} variant="body">
        {value}
      </TerminalText>
      <TerminalText tone="dim" variant="micro">
        {label}
      </TerminalText>
    </View>
  );
}

function LeaderboardResultRow({
  compact,
  isCurrentUser,
  multiplier,
  row
}: {
  compact: boolean;
  isCurrentUser: boolean;
  multiplier?: number;
  row: CategoryLeaderboardRow;
}) {
  return (
    <View style={[
      styles.resultRow,
      compact ? styles.resultRowCompact : null,
      isCurrentUser ? styles.currentUserRow : null
    ]}>
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
      <TerminalText glow={row.rank <= 3} style={styles.resultScore} tone="cyan" variant="body">
        {row.categoryEntries}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg
  },
  headerTopLine: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31
  },
  intro: {
    fontFamily: fontFamilies.body
  },
  myStandingCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  standingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  standingIdentity: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  myName: {
    fontFamily: fontFamilies.display
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  overviewMetric: {
    width: '48%',
    minHeight: 68,
    justifyContent: 'center',
    gap: 2,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  overviewValue: {
    fontFamily: fontFamilies.display
  },
  hubNav: {
    marginBottom: spacing.lg
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
    minWidth: 38,
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderPinkStrong,
    borderRadius: 5,
    backgroundColor: colors.surfacePinkFaint
  },
  resultScore: {
    width: 42,
    textAlign: 'right'
  },
  rankingRules: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted
  },
  winnersButton: {
    marginTop: spacing.md
  },
  pressableCard: {
    width: '100%'
  },
  drawCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderStyle: 'dashed'
  },
  drawCopy: {
    minWidth: 0,
    flex: 1
  },
  drawTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
