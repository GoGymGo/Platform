import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/auth';
import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import {
  useAppData,
  useCategoryLeaderboards,
  usePayoutWinners,
  useSettledCompetition
} from '@/data/appDataHooks';
import {
  calculateRankedPrizeDrawPayouts,
  goalCategories
} from '@/domain/campaignEconomics';
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
import { formatCampaignCurrency, useSponsorCampaign } from '@/state/sponsorCampaign';

export default function WinnersCircleScreen() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { user } = useAuth();
  const { mode: appDataMode } = useAppData();
  const { competitionRegion } = useCompetitionRegion();
  const { campaign } = useSponsorCampaign();
  const [closing, setClosing] = useState(false);
  const [selectedResults, setSelectedResults] = useState<'categories' | 'payouts'>('categories');
  const isAutomaticLoginView = auto === '1';
  const regionalDateKey = getCompetitionRegionDateKey(
    new Date(),
    competitionRegion.timeZone
  );
  const completedMonthKey = getPreviousCompetitionMonthKey(
    getCompetitionMonthKey(regionalDateKey)
  );
  const { data: settledCompetition, isPending: settledCompetitionPending } =
    useSettledCompetition();
  const { data: categoryLeaderboards = [], isPending: categoryResultsPending } =
    useCategoryLeaderboards(goalCategories);
  const categoryChampions = [...categoryLeaderboards]
    .reverse()
    .flatMap((leaderboard) => {
      const winner = leaderboard?.rows[0];
      return winner ? [{ goal: leaderboard.goal, winner }] : [];
    });
  const payoutSchedule = useMemo(
    () =>
      settledCompetition ?
        calculateRankedPrizeDrawPayouts(
          settledCompetition.payoutPoolAmount,
          settledCompetition.payoutWinnerCount,
          settledCompetition.payoutExponent
        ) : [],
    [settledCompetition]
  );
  const { data: payoutWinners = [], isPending: payoutResultsPending } =
    usePayoutWinners(payoutSchedule);

  async function closeWinnersCircle() {
    setClosing(true);

    try {
      await markWinnersCircleSeen(
        user?.uid ?? 'local-preview',
        competitionRegion.timeZone
      );
    } finally {
      router.replace(isAutomaticLoginView ? '/home' : '/leaderboard');
      setClosing(false);
    }
  }

  if (
    settledCompetitionPending ||
    categoryResultsPending ||
    (settledCompetition && payoutResultsPending)
  ) {
    return null;
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
            <TerminalText style={styles.unavailableCopy} tone="muted" variant="body">
              SETTLED CATEGORY CHAMPIONS AND PRIZE DRAW PAYOUTS WILL APPEAR HERE AFTER RESULTS ARE AUDITED.
            </TerminalText>
            <CyberButtonPrimary
              label={isAutomaticLoginView ? 'ENTER GOGYMGO ->' : 'BACK TO RANKS'}
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
        >
          <View style={styles.header}>
            <TerminalText glow tone="pink" variant="label">
              {`${appDataMode === 'demo' ? 'SAMPLE RESULTS' : 'MONTHLY RESULTS'} // ${campaign.region}`}
            </TerminalText>
            <TerminalText glow style={styles.title} tone="pink" variant="title">
              WINNERS CIRCLE
            </TerminalText>
            <TerminalText style={styles.month} tone="text" variant="body">
              {formatCompetitionMonth(completedMonthKey)}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Celebrate the seven commitment-category champions and the players
              selected for real cash payouts in the regional prize draw.
            </TerminalText>
          </View>

          <HUDBorderBox glow style={styles.summaryCard} tone="pink">
            <View style={styles.summaryMetric}>
              <TerminalText glow tone="pink" variant="value">
                7
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                CATEGORY CHAMPIONS
              </TerminalText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}>
              <TerminalText glow tone="pink" variant="value">
                {settledCompetition.payoutWinnerCount.toLocaleString()}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                PAID PLAYERS
              </TerminalText>
            </View>
          </HUDBorderBox>

          <View accessibilityRole="tablist" style={styles.resultTabs}>
            <ResultTab
              label="CATEGORY CHAMPIONS"
              onPress={() => setSelectedResults('categories')}
              selected={selectedResults === 'categories'}
            />
            <ResultTab
              label="PRIZE DRAW WINNERS"
              onPress={() => setSelectedResults('payouts')}
              selected={selectedResults === 'payouts'}
            />
          </View>

          {selectedResults === 'categories' ? (
            <>
              <View style={styles.sectionHeader}>
                <TerminalText glow tone="cyan" variant="label">
                  CATEGORY CHAMPIONS
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Highest settled category score in each commitment group.
                </TerminalText>
              </View>

              <HUDBorderBox style={styles.resultsPanel} tone="cyan">
                {categoryChampions.map(({ goal, winner }, index) => (
                  <View
                    key={goal}
                    style={[
                      styles.winnerRow,
                      index === categoryChampions.length - 1 ? styles.lastRow : null
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
                      <TerminalText style={styles.winnerName} tone="text" variant="body">
                        {winner.alias}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        CATEGORY CHAMPION
                      </TerminalText>
                    </View>
                    <View style={styles.scoreBlock}>
                      <TerminalText glow tone="cyan" variant="body">
                        {winner.categoryEntries}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        CATEGORY SCORE
                      </TerminalText>
                    </View>
                  </View>
                ))}
              </HUDBorderBox>
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <TerminalText glow tone="pink" variant="label">
                  PRIZE DRAW WINNERS
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Top 10 payout ranks shown. Every selected player receives cash.
                </TerminalText>
              </View>

              <HUDBorderBox glow style={styles.resultsPanel} tone="pink">
                {payoutWinners.map((winner, index) => (
                  <View
                    key={winner.payoutRank}
                    style={[
                      styles.winnerRow,
                      index === payoutWinners.length - 1 ? styles.lastRow : null
                    ]}
                  >
                    <TerminalText
                      glow={winner.payoutRank === 1}
                      style={styles.payoutRank}
                      tone={winner.payoutRank === 1 ? 'pink' : 'cyan'}
                      variant="label"
                    >
                      {String(winner.payoutRank).padStart(2, '0')}
                    </TerminalText>
                    <View style={styles.winnerCopy}>
                      <TerminalText style={styles.winnerName} tone="text" variant="body">
                        {winner.alias}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        VERIFIED PAYOUT WINNER
                      </TerminalText>
                    </View>
                    <TerminalText glow tone="pink" variant="body">
                      {formatCampaignCurrency(winner.amount)}
                    </TerminalText>
                  </View>
                ))}
                <TerminalText style={styles.payoutFooter} tone="dim" uppercase={false} variant="caption">
                  Showing the top {payoutWinners.length} of{' '}
                  {settledCompetition.payoutWinnerCount.toLocaleString()} paid players.
                </TerminalText>
              </HUDBorderBox>
            </>
          )}

          <CyberButtonPrimary
            disabled={closing}
            label={closing ? 'SAVING...' : isAutomaticLoginView ? 'ENTER GOGYMGO ->' : 'BACK TO RANKS'}
            onPress={closeWinnersCircle}
            style={styles.closeButton}
            tone="cyan"
          />
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
  payoutRank: {
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
  payoutFooter: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.borderPinkSubtle
  },
  closeButton: {
    marginTop: spacing.xs
  },
  pressed: {
    opacity: 0.74
  }
});
