import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/auth';
import { CompetitionHubNav } from '@/components/competitionHubNav';
import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton } from '@/components/onboarding';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import {
  useCategoryLeaderboards,
  useRewardWinners,
  useSettledCompetition
} from '@/data/appDataHooks';
import { goalCategories } from '@/domain/campaignEconomics';
import {
  getCompetitionMonthKey,
  getCompetitionRegionDateKey
} from '@/domain/competition';
import {
  formatCompetitionMonth,
  getPreviousCompetitionMonthKey
} from '@/domain/winnersCircle';
import { markWinnersCircleSeen } from '@/services/winnersCircle';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function WinnersCircleScreen() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { user } = useAuth();
  const { competitionRegion } = useCompetitionRegion();
  const { campaign } = useSponsorCampaign();
  const { weeklyGoal } = useWorkoutProgress();
  const [closing, setClosing] = useState(false);
  const [selectedResults, setSelectedResults] = useState<'categories' | 'rewards'>('categories');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const isAutomaticLoginView = auto === '1';
  const regionalDateKey = getCompetitionRegionDateKey(
    new Date(),
    competitionRegion.timeZone
  );
  const completedMonthKey = getPreviousCompetitionMonthKey(
    getCompetitionMonthKey(regionalDateKey)
  );
  const {
    data: settledCompetitionResult,
    isError: settledCompetitionError,
    isPending: settledCompetitionPending,
    refetch: refetchSettledCompetition
  } =
    useSettledCompetition();
  const {
    data: categoryLeaderboardResults = [],
    isError: categoryResultsError,
    isPending: categoryResultsPending,
    refetch: refetchCategoryResults
  } =
    useCategoryLeaderboards(goalCategories);
  const {
    data: rewardWinnerResults = [],
    isError: rewardResultsError,
    isPending: rewardResultsPending,
    refetch: refetchRewardResults
  } =
    useRewardWinners();
  const resultsUnavailable =
    settledCompetitionError || categoryResultsError || rewardResultsError;
  const settledCompetition = settledCompetitionResult;
  const categoryLeaderboards = categoryLeaderboardResults;
  const rewardWinners = rewardWinnerResults;
  const categoryChampions = [...categoryLeaderboards]
    .reverse()
    .flatMap((leaderboard) => {
      const winner = leaderboard?.rows[0];
      return winner ? [{ goal: leaderboard.goal, winner }] : [];
    });
  const currentCategoryChampion = categoryChampions.find(({ goal }) => goal === weeklyGoal);
  const visibleCategoryChampions = showAllCategories
    ? categoryChampions
    : currentCategoryChampion
      ? [currentCategoryChampion]
      : categoryChampions.slice(0, 1);

  async function closeWinnersCircle() {
    setClosing(true);

    try {
      if (user) {
        await markWinnersCircleSeen(user.uid, competitionRegion.timeZone);
      }
    } finally {
      router.replace(isAutomaticLoginView ? '/home' : '/leaderboard');
      setClosing(false);
    }
  }

  if (
    settledCompetitionPending ||
    categoryResultsPending ||
    (settledCompetitionResult && rewardResultsPending)
  ) {
    return (
      <AuthGate>
        <ScreenLoadingState
          body="Loading audited Weekly Goal and prize-draw results."
          label="LOADING WINNERS CIRCLE"
        />
      </AuthGate>
    );
  }

  if (resultsUnavailable) {
    return (
      <AuthGate>
        <ScreenContainer contentStyle={styles.unavailableScreen}>
          <HUDBorderBox glow style={styles.unavailableCard} tone="red">
            <TerminalText live="assertive" glow tone="red" variant="label">
              RESULTS COULD NOT LOAD
            </TerminalText>
            <TerminalText style={styles.unavailableCopy} tone="muted" uppercase={false} variant="body">
              Check your connection and try loading the Winners Circle again.
            </TerminalText>
            <CyberButtonPrimary
              label="TRY AGAIN"
              onPress={() => void Promise.all([
                refetchSettledCompetition(),
                refetchCategoryResults(),
                refetchRewardResults()
              ])}
              tone="red"
            />
          </HUDBorderBox>
        </ScreenContainer>
      </AuthGate>
    );
  }

  if (!settledCompetition) {
    return (
      <AuthGate>
        <ScreenContainer contentStyle={styles.unavailableScreen}>
          <HUDBorderBox style={styles.unavailableCard} tone="amber">
            <TerminalText glow tone="amber" variant="label">
              RESULTS NOT AVAILABLE YET
            </TerminalText>
            <TerminalText glow style={styles.unavailableTitle} tone="cyan" variant="title">
              WINNERS CIRCLE
            </TerminalText>
            <TerminalText style={styles.unavailableCopy} tone="muted" uppercase={false} variant="body">
              Weekly Goal champions and brand reward winners will appear here after results are audited.
            </TerminalText>
            <CyberButtonPrimary
              label={isAutomaticLoginView ? 'ENTER GOGYMGO ->' : 'VIEW COMPETITION'}
              onPress={() => router.replace(isAutomaticLoginView ? '/home' : '/leaderboard')}
              style={styles.closeButton}
            />
          </HUDBorderBox>
        </ScreenContainer>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <ScreenContainer>
        <SponsorBanner />
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
        >
          <CompetitionHubNav active="winners" style={styles.hubNav} />

          <View style={styles.header}>
            <TerminalText glow tone="pink" variant="label">
              {`MONTHLY RESULTS // ${campaign.region}`}
            </TerminalText>
            <TerminalText glow style={styles.title} tone="pink" variant="title">
              WINNERS CIRCLE
            </TerminalText>
            <TerminalText style={styles.month} tone="text" variant="body">
              {formatCompetitionMonth(completedMonthKey)}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Celebrate the seven Weekly Goal champions and the players
              selected for physical prizes and coupon codes in the regional draw.
            </TerminalText>
          </View>

          <HUDBorderBox glow style={styles.summaryCard} tone="pink">
            <View style={styles.summaryMetric}>
              <TerminalText glow tone="pink" variant="value">
                {categoryChampions.length}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                GOAL CHAMPIONS
              </TerminalText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}>
              <TerminalText glow tone="pink" variant="value">
                {settledCompetition.rewardCount.toLocaleString()}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                REWARD WINNERS
              </TerminalText>
            </View>
          </HUDBorderBox>

          <View accessibilityRole="tablist" style={styles.resultTabs}>
            <ResultTab
              label="GOAL CHAMPIONS"
              onPress={() => setSelectedResults('categories')}
              selected={selectedResults === 'categories'}
            />
            <ResultTab
              label="PRIZE DRAW WINNERS"
              onPress={() => setSelectedResults('rewards')}
              selected={selectedResults === 'rewards'}
            />
          </View>

          {selectedResults === 'categories' ? (
            <>
              <View style={styles.sectionHeader}>
                <TerminalText glow tone="cyan" variant="label">
                  GOAL CHAMPIONS
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Highest settled score in each Weekly Goal group.
                </TerminalText>
              </View>

              <HUDBorderBox style={styles.resultsPanel} tone="cyan">
                {visibleCategoryChampions.map(({ goal, winner }, index) => (
                  <View
                    key={goal}
                    style={[
                      styles.winnerRow,
                      index === visibleCategoryChampions.length - 1 ? styles.lastRow : null
                    ]}
                  >
                    <View style={styles.goalBadge}>
                      <TerminalText glow tone="cyan" variant="body">
                        {goal}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        DAY
                      </TerminalText>
                    </View>
                    <View style={styles.winnerCopy}>
                      <UserAlias
                        alias={winner.alias}
                        streaks={winner.streaks}
                        textStyle={styles.winnerName}
                      />
                      <TerminalText tone="dim" variant="micro">
                        GOAL CHAMPION
                      </TerminalText>
                    </View>
                    <View style={styles.scoreBlock}>
                      <TerminalText glow tone="cyan" variant="body">
                        {winner.categoryEntries}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        GOAL SCORE
                      </TerminalText>
                    </View>
                  </View>
                ))}
                <CompactTextButton
                  label={showAllCategories ? 'SHOW MY GOAL GROUP' : 'VIEW ALL 7 GOAL GROUPS'}
                  onPress={() => setShowAllCategories((current) => !current)}
                  tone={showAllCategories ? 'muted' : 'cyan'}
                />
              </HUDBorderBox>
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <TerminalText glow tone="pink" variant="label">
                  PRIZE DRAW WINNERS
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Every selected player receives the physical prize or coupon shown.
                </TerminalText>
              </View>

              <HUDBorderBox glow style={styles.resultsPanel} tone="pink">
                {rewardWinners.map((winner, index) => (
                  <View
                    key={`${winner.awardRank}:${winner.alias}`}
                    style={[
                      styles.winnerRow,
                      index === rewardWinners.length - 1 ? styles.lastRow : null
                    ]}
                  >
                    <TerminalText
                      glow={winner.awardRank === 1}
                      style={styles.rewardRank}
                      tone={winner.awardRank === 1 ? 'pink' : 'cyan'}
                      variant="label"
                    >
                      {String(winner.awardRank).padStart(2, '0')}
                    </TerminalText>
                    <View style={styles.winnerCopy}>
                      <UserAlias
                        alias={winner.alias}
                        streaks={winner.streaks}
                        textStyle={styles.winnerName}
                      />
                      <TerminalText tone="dim" variant="micro">
                        {winner.rewardType === 'coupon' ? 'COUPON WINNER' : 'PHYSICAL PRIZE WINNER'}
                      </TerminalText>
                    </View>
                    <View style={styles.rewardName}>
                      <TerminalText glow tone="pink" variant="body">
                        {winner.rewardTitle}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        {winner.sponsorName}
                      </TerminalText>
                    </View>
                  </View>
                ))}
                <TerminalText style={styles.rewardFooter} tone="dim" uppercase={false} variant="caption">
                  Showing {rewardWinners.length} of{' '}
                  {settledCompetition.rewardCount.toLocaleString()} reward winners.
                </TerminalText>
              </HUDBorderBox>
            </>
          )}

          {isAutomaticLoginView ? (
            <CyberButtonPrimary
              disabled={closing}
              label={closing ? 'SAVING...' : 'ENTER GOGYMGO ->'}
              onPress={closeWinnersCircle}
              style={styles.closeButton}
              tone="cyan"
            />
          ) : null}
        </ScreenScrollView>
      </ScreenContainer>
    </AuthGate>
  );
}

function ResultTab({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultTab,
        selected ? styles.resultTabSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText glow={selected} tone={selected ? 'cyan' : 'muted'} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  unavailableScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenX,
    backgroundColor: colors.background
  },
  unavailableCard: {
    gap: spacing.md,
    padding: spacing.xl
  },
  unavailableTitle: {
    fontFamily: fontFamilies.display
  },
  unavailableCopy: {
    fontFamily: fontFamilies.body
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  hubNav: {
    marginBottom: spacing.lg
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  title: {
    fontFamily: fontFamilies.display
  },
  month: {
    fontFamily: fontFamilies.display
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.xl,
    padding: spacing.lg
  },
  summaryMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: spacing.md,
    backgroundColor: colors.borderPinkMuted
  },
  resultTabs: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 8,
    backgroundColor: colors.panelAlpha70
  },
  resultTab: {
    minWidth: 0,
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 5
  },
  resultTabSelected: {
    backgroundColor: colors.surfaceCyanActive
  },
  sectionHeader: {
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  resultsPanel: {
    paddingVertical: 0,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl
  },
  winnerRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  lastRow: {
    borderBottomWidth: 0
  },
  goalBadge: {
    width: 38,
    alignItems: 'center'
  },
  rewardRank: {
    width: 38,
    textAlign: 'center'
  },
  winnerCopy: {
    flex: 1
  },
  winnerName: {
    fontFamily: fontFamilies.bodyStrong
  },
  scoreBlock: {
    alignItems: 'flex-end'
  },
  rewardFooter: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.borderPinkSubtle
  },
  rewardName: {
    maxWidth: 150,
    alignItems: 'flex-end'
  },
  closeButton: {
    marginTop: spacing.xs
  },
  pressed: {
    opacity: 0.74
  }
});
