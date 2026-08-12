import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { InlineHelpButton } from '@/components/clarity';
import { CompetitionHubNav } from '@/components/competitionHubNav';
import { LeaderboardResultRow } from '@/components/contestLeaderboard';
import {
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton } from '@/components/onboarding';
import { RecoverableError } from '@/components/reliability';
import { BrandScreenHeader } from '@/components/screenLayout';
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useCategoryLeaderboard, useMyStreaks } from '@/data/appDataHooks';
import { type GoalCategory } from '@/domain/campaignEconomics';
import { getCompetitionRankLabel } from '@/domain/competition';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useProfile } from '@/state/profile';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function ContestOverviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { competitionRegion } = useCompetitionRegion();
  const { publicName } = useProfile();
  const { competition, currentWeekVerified, totalEntries, weeklyGoal } =
    useWorkoutProgress();
  const [showRankingRules, setShowRankingRules] = useScreenMemory(
    'leaderboard:ranking-rules',
    false
  );
  const myLeaderboardQuery = useCategoryLeaderboard(weeklyGoal as GoalCategory);
  const { data: streakSummary } = useMyStreaks();
  const competitionNotStarted = competition.phase === 'before-month';
  const hasSettledWeek = competition.periodResults.some(
    (period) => period.status === 'settled'
  );
  const categoryScore = competition.periodEntriesBeforePerfectMonth;
  const myLeaderboardRows = Array.isArray(myLeaderboardQuery.data?.rows)
    ? myLeaderboardQuery.data.rows
    : [];
  const myStanding = myLeaderboardRows.find(
    ({ alias }) => alias.toLowerCase() === publicName.toLowerCase()
  );
  const currentRankLabel = getCompetitionRankLabel({
    competitionNotStarted,
    hasSettledWeek,
    rank: myStanding?.rank
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
        <BrandScreenHeader
          accessory={
            <InlineHelpButton
              label="Open contest guide"
              onPress={() => router.push('/how-it-works?from=leaderboard')}
            />
          }
          description="Track your rank, entries and Weekly Challenge."
          eyebrow={`${competitionRegion.label} // MONTHLY CONTEST`}
          title="REGIONAL CONTEST"
        />

        <CompetitionHubNav active="rankings" style={styles.hubNav} />

        <HUDBorderBox style={styles.myStandingCard} tone="cyan">
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
            <TerminalText tone="cyan" variant="label">
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
              label="ACHIEVED THIS WEEK"
              tone="green"
              value={`${Math.min(currentWeekVerified, weeklyGoal)} OF ${weeklyGoal}`}
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
          <TerminalText
            live="polite"
            tone="dim"
            uppercase={false}
            variant="caption"
          >
            {competitionNotStarted
              ? 'Rankings begin after the first scoring week.'
              : `Goal Score ${categoryScore} sets your rank. Entries set your Prize Draw odds.`}
          </TerminalText>
          <CompactTextButton
            label={
              showRankingRules ? 'Hide ranking details' : 'How ranking works'
            }
            onPress={() => setShowRankingRules((current) => !current)}
            tone={showRankingRules ? 'muted' : 'cyan'}
          />
          {showRankingRules ? (
            <View style={styles.rankingRules}>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Goal Score includes each settled week&apos;s 1x, 2x or 3x Weekly
                Challenge result. Equal scores are resolved by verified contest
                days, then the published audited tie-break.
              </TerminalText>
            </View>
          ) : null}
        </HUDBorderBox>

        <View style={styles.positionHeading}>
          <TerminalText glow tone="cyan" variant="label">
            YOUR LEADERBOARD POSITION
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="caption">
            Your current place in the {weeklyGoal}-day Weekly Goal group.
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.positionCard} tone="cyan">
          {myLeaderboardQuery.isError ? (
            <RecoverableError
              body="Your current rank could not be loaded. Your contest progress and entries are unchanged."
              onRetry={() => {
                void recordFlowMetric(user?.uid, 'flow-retry', 'leaderboard');
                void myLeaderboardQuery.refetch();
              }}
              retrying={myLeaderboardQuery.isFetching}
              title="COULD NOT LOAD YOUR RANK"
            />
          ) : hasSettledWeek && myStanding ? (
            <LeaderboardResultRow isCurrentUser row={myStanding} />
          ) : (
            <View style={styles.rankPending}>
              <TerminalText live="polite" glow tone="cyan" variant="body">
                {myLeaderboardQuery.isPending ? 'LOADING...' : currentRankLabel}
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Your individual position will update here after scoring settles.
              </TerminalText>
            </View>
          )}
          <CompactTextButton
            label="VIEW LEADERBOARD / WINNERS ->"
            onPress={() => router.push('/leaderboard/standings')}
            tone="cyan"
          />
        </HUDBorderBox>
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
      <TerminalText
        glow
        style={styles.overviewValue}
        tone={tone}
        variant="body"
      >
        {value}
      </TerminalText>
      <TerminalText tone="dim" variant="micro">
        {label}
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
    backgroundColor: colors.transparent
  },
  hubNav: {
    marginBottom: spacing.lg
  },
  myStandingCard: {
    gap: spacing.md,
    marginBottom: spacing.xl,
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
  rankingRules: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted
  },
  positionHeading: {
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  positionCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  rankPending: {
    gap: spacing.xs,
    paddingVertical: spacing.md
  }
});
