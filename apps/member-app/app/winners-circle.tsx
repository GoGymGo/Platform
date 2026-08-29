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
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useMyLatestCompetitionResults } from '@/data/appDataHooks';
import {
  formatCompetitionMonth,
  getWinnersCirclePresentationKey,
} from "@/domain/winnersCircle";
import { markWinnersCircleSeen } from "@/services/winnersCircle";
import { useAuth } from "@/state/auth";

export default function WinnersCircleScreen() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { user } = useAuth();
  const [closing, setClosing] = useState(false);
  const [selectedResults, setSelectedResults] = useState<'categories' | 'rewards'>('categories');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const isAutomaticLoginView = auto === '1';
  const {
    data: participantResults,
    isError: resultsUnavailable,
    isPending: resultsPending,
    isRefetching: resultsRefreshing,
    refetch: refetchResults
  } = useMyLatestCompetitionResults();
  const categoryLeaderboards = participantResults?.categoryLeaderboards ?? [];
  const rewardWinners = participantResults?.rewardWinners ?? [];
  const categoryChampions = [...categoryLeaderboards]
    .reverse()
    .flatMap((leaderboard) => {
      const winner = leaderboard?.rows[0];
      return winner ? [{ goal: leaderboard.goal, winner }] : [];
    });
  const currentCategoryChampion = categoryChampions.find(
    ({ goal }) => goal === participantResults?.participantGoalDays
  );
  const visibleCategoryChampions = showAllCategories
    ? categoryChampions
    : currentCategoryChampion
      ? [currentCategoryChampion]
      : categoryChampions.slice(0, 1);

  async function closeWinnersCircle() {
    setClosing(true);

    try {
      if (user && participantResults) {
        await markWinnersCircleSeen(
          user.uid,
          getWinnersCirclePresentationKey(participantResults)
        );
      }
    } finally {
      router.replace(isAutomaticLoginView ? '/home' : '/leaderboard');
      setClosing(false);
    }
  }

  if (resultsPending) {
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
              disabled={resultsRefreshing}
              label={resultsRefreshing ? 'RETRYING...' : 'TRY AGAIN'}
              onPress={() => void refetchResults()}
              tone="red"
            />
          </HUDBorderBox>
        </ScreenContainer>
      </AuthGate>
    );
  }

  if (!participantResults) {
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
              label={isAutomaticLoginView ? 'ENTER GOGYMGO ->' : 'VIEW CONTEST'}
              onPress={() => router.replace(isAutomaticLoginView ? '/home' : '/leaderboard')}
              style={styles.closeButton}
            />
          </HUDBorderBox>
        </ScreenContainer>
      </AuthGate>
    );
  }

  if (participantResults.resultsStatus === 'pending') {
    return (
      <AuthGate>
        <ScreenContainer contentStyle={styles.unavailableScreen}>
          <HUDBorderBox glow style={styles.unavailableCard} tone="amber">
            <TerminalText glow tone="amber" variant="label">
              RESULTS UNDER REVIEW
            </TerminalText>
            <TerminalText glow style={styles.unavailableTitle} tone="cyan" variant="title">
              {participantResults.competitionName}
            </TerminalText>
            <TerminalText style={styles.unavailableCopy} tone="muted" uppercase={false} variant="body">
              Your Contest is complete. GoGymGo is finalizing the audited results and will show your placement and reward here as soon as they are published.
            </TerminalText>
            <CyberButtonPrimary
              disabled={closing}
              label={closing ? 'SAVING...' : 'CONTINUE TO HOME ->'}
              onPress={closeWinnersCircle}
              style={styles.closeButton}
              tone="cyan"
            />
          </HUDBorderBox>
        </ScreenContainer>
      </AuthGate>
    );
  }

  const completedMonthKey = participantResults.monthKey;

  return (
    <AuthGate>
      <ScreenContainer>
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
        >
          <CompetitionHubNav active="winners" style={styles.hubNav} />

          <BrandScreenHeader
            accent="pink"
            description={`${formatCompetitionMonth(completedMonthKey)}. See the Weekly Goal champions and every player selected in the regional prize draw.`}
            eyebrow={`FINAL RESULTS // ${participantResults.regionName}`}
            title="WINNERS CIRCLE"
          />

          <HUDBorderBox style={styles.summaryCard} tone="pink">
            <View style={styles.summaryMetric}>
              <TerminalText tone="pink" variant="value">
                {categoryChampions.length}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                GOAL CHAMPIONS
              </TerminalText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}>
              <TerminalText tone="pink" variant="value">
                {participantResults.rewardCount.toLocaleString()}
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
                <TerminalText tone="cyan" variant="label">
                  GOAL CHAMPIONS
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Highest settled score in each Weekly Goal group.
                </TerminalText>
              </View>

              <HUDBorderBox style={styles.resultsPanel} tone="cyan">
                {visibleCategoryChampions.length === 0 ? (
                  <TerminalText style={styles.rewardFooter} tone="muted" uppercase={false} variant="body">
                    No category champions were published for this Contest.
                  </TerminalText>
                ) : null}
                {visibleCategoryChampions.map(({ goal, winner }, index) => (
                  <View
                    key={goal}
                    style={[
                      styles.winnerRow,
                      index === visibleCategoryChampions.length - 1 ? styles.lastRow : null
                    ]}
                  >
                    <View style={styles.goalBadge}>
                      <TerminalText tone="cyan" variant="body">
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
                      <TerminalText tone="cyan" variant="body">
                        {winner.categoryEntries}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        GOAL SCORE
                      </TerminalText>
                    </View>
                  </View>
                ))}
                {categoryChampions.length > 1 ? (
                  <CompactTextButton
                    label={showAllCategories ? 'SHOW MY GOAL GROUP' : 'VIEW ALL GOAL GROUPS'}
                    onPress={() => setShowAllCategories((current) => !current)}
                    tone={showAllCategories ? 'muted' : 'cyan'}
                  />
                ) : null}
              </HUDBorderBox>
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <TerminalText tone="pink" variant="label">
                  PRIZE DRAW WINNERS
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Every selected player receives the settled reward shown. Cash
                  is handed over in person and recorded by an authorized
                  administrator; the app does not initiate a transfer.
                </TerminalText>
              </View>

              <HUDBorderBox style={styles.resultsPanel} tone="pink">
                {rewardWinners.length === 0 ? (
                  <TerminalText style={styles.rewardFooter} tone="muted" uppercase={false} variant="body">
                    No reward winners were published for this Contest.
                  </TerminalText>
                ) : null}
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
                        {winner.rewardType === 'coupon'
                          ? 'COUPON WINNER'
                          : winner.rewardType === 'cash'
                            ? 'CASH PRIZE WINNER'
                            : 'PHYSICAL PRIZE WINNER'}
                      </TerminalText>
                    </View>
                    <View style={styles.rewardName}>
                      <TerminalText tone="pink" variant="body">
                        {winner.rewardTitle}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        {winner.prizeDrawEntries.toLocaleString()} DRAW{' '}
                        {winner.prizeDrawEntries === 1 ? 'ENTRY' : 'ENTRIES'}
                        {' // '}
                        {winner.sponsorName}
                      </TerminalText>
                    </View>
                  </View>
                ))}
                {rewardWinners.length > 0 ? (
                  <TerminalText style={styles.rewardFooter} tone="dim" uppercase={false} variant="caption">
                    Showing every published reward winner ({participantResults.rewardCount.toLocaleString()}).
                  </TerminalText>
                ) : null}
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
          ) : (
            <CompactTextButton
              label="BACK TO CURRENT LEADERBOARD ->"
              onPress={() => router.replace('/leaderboard/standings')}
              tone="cyan"
            />
          )}
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
      <TerminalText tone={selected ? 'cyan' : 'muted'} variant="micro">
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
    backgroundColor: colors.transparent
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
  content: brandScreenStyles.content,
  hubNav: {
    marginBottom: spacing.lg
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
