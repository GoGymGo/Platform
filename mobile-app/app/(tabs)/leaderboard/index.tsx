import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton } from '@/components/onboarding';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, componentSizes, fontFamilies, fontSizes, interactionStates, spacing } from '@/constants/theme';
import type { CategoryLeaderboardRow } from '@/data/appData';
import { useCategoryLeaderboard } from '@/data/appDataHooks';
import { type GoalCategory } from '@/domain/campaignEconomics';
import { useProfile } from '@/state/profile';
import { formatCampaignCurrency, useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

const goalCategories = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly GoalCategory[];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { publicName } = useProfile();
  const { campaign, economics } = useSponsorCampaign();
  const {
    competition,
    weeklyGoal
  } = useWorkoutProgress();
  const [selectedGoal, setSelectedGoal] = useState<GoalCategory | null>(null);
  const [showRankingRules, setShowRankingRules] = useState(false);
  const displayedGoal = selectedGoal ?? (weeklyGoal as GoalCategory);
  const { data: selectedLeaderboard, isPending: leaderboardPending } =
    useCategoryLeaderboard(displayedGoal);
  const competitionNotStarted = competition.phase === 'before-month';
  const hasSettledWeek = competition.periodResults.some((period) => period.status === 'settled');
  const categoryScore = competition.periodEntriesBeforePerfectMonth;
  const sponsorConfirmed = campaign.status === 'approved';
  const standingsVisible = !competitionNotStarted;

  return (
    <ScreenContainer>
      <SponsorBanner compact />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            {campaign.region}{' // MONTHLY COMPETITION'}
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            REGIONAL RANKINGS
          </TerminalText>
          <TerminalText style={styles.intro} tone="muted" uppercase={false} variant="body">
            Category Score determines your rank. Prize Draw Entries determine
            your odds of being paid.
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.myStandingCard} tone="cyan">
          <View style={styles.standingHeader}>
            <View style={styles.standingIdentity}>
              <TerminalText tone="dim" variant="label">
                YOUR STANDING
              </TerminalText>
              <TerminalText style={styles.myName} tone="text" uppercase={false} variant="body">
                {publicName}
              </TerminalText>
            </View>
            <TerminalText glow tone="cyan" variant="label">
              {weeklyGoal}-DAY CATEGORY
            </TerminalText>
          </View>
          {competitionNotStarted ? (
            <HUDBorderBox style={styles.standingPending} tone="muted">
              <TerminalText glow tone="cyan" variant="label">
                RANKINGS OPEN AFTER SCORING WEEK 1
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Verified workouts currently build your personal workout history. Your
                first category score appears after scoring week 1 settles.
              </TerminalText>
            </HUDBorderBox>
          ) : (
            <>
              <View style={styles.standingMetrics}>
                <View style={styles.standingMetric}>
                  <TerminalText glow style={styles.standingValue} tone="cyan" variant="value">
                    {hasSettledWeek ? 'SYNCING' : 'PENDING'}
                  </TerminalText>
                  <TerminalText tone="muted" variant="micro">
                    CURRENT RANK
                  </TerminalText>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.standingMetric}>
                  <TerminalText glow style={styles.standingValue} tone="cyan" variant="value">
                    {categoryScore}
                  </TerminalText>
                  <TerminalText tone="muted" variant="micro">
                    CATEGORY SCORE
                  </TerminalText>
                </View>
              </View>
              <TerminalText tone="dim" variant="caption">
                {hasSettledWeek
                  ? 'CURRENT CATEGORY RANK UPDATES AFTER EACH SCORING WEEK.'
                  : 'YOUR FIRST RANK APPEARS WHEN THE CURRENT SCORING WEEK SETTLES.'}
              </TerminalText>
            </>
          )}
        </HUDBorderBox>

        {standingsVisible ? <>
        <View style={styles.categorySection}>
          <TerminalText glow tone="cyan" variant="label">
            VIEW CATEGORY
          </TerminalText>
          <View accessibilityRole="radiogroup" style={styles.categorySelector}>
            {goalCategories.map((goal) => {
              const selected = goal === displayedGoal;

              return (
                <Pressable
                  accessibilityLabel={`${goal}-day category`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={goal}
                  onPress={() => setSelectedGoal(goal)}
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
        </View>

        <HUDBorderBox glow style={styles.topTenPanel} tone="cyan">
          <View style={styles.topTenHeader}>
            <View style={styles.topTenHeading}>
              <TerminalText glow tone="cyan" variant="label">
                TOP 10{' // '}{displayedGoal}-DAY CATEGORY
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Top three finishers receive 3x, 2x and 1.5x entry boosts.
              </TerminalText>
            </View>
            <TerminalText tone="dim" variant="micro">
              CATEGORY SCORE
            </TerminalText>
          </View>

          <View style={styles.topTenList}>
            {selectedLeaderboard?.rows.map((row) => (
              <LeaderboardResultRow
                isCurrentUser={row.alias.toLowerCase() === publicName.toLowerCase()}
                key={row.rank}
                multiplier={row.rank <= 3
                  ? campaign.economics.categoryPodiumMultipliers[row.rank as 1 | 2 | 3]
                  : undefined}
                row={row}
              />
            ))}
            {!leaderboardPending && !selectedLeaderboard ? (
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

          <CompactTextButton
            label={showRankingRules ? 'HIDE RANKING RULES' : 'HOW RANKING WORKS'}
            onPress={() => setShowRankingRules((current) => !current)}
            tone={showRankingRules ? 'muted' : 'cyan'}
          />

          {showRankingRules ? (
            <HUDBorderBox style={styles.rankingRules} tone="muted">
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Category Score updates after each scoring week settles and includes
                that week&apos;s 1x, 2x or 3x Period Match result.
              </TerminalText>
              <TerminalText tone="dim" uppercase={false} variant="caption">
                Equal scores are resolved by verified competition days, then the
                published audited tie-break.
              </TerminalText>
            </HUDBorderBox>
          ) : null}
        </HUDBorderBox>
        </> : null}

        <CyberButtonOutline
          label="VIEW WINNERS CIRCLE ->"
          onPress={() => router.push('/winners-circle')}
          style={styles.winnersButton}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/leaderboard/draw')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox glow={sponsorConfirmed} style={styles.drawCard} tone={sponsorConfirmed ? 'pink' : 'cyan'}>
            <View style={styles.drawCopy}>
              <TerminalText glow tone={sponsorConfirmed ? 'pink' : 'cyan'} variant="micro">
                PRIZE DRAW // 15% OF PLAYERS GET PAID
              </TerminalText>
              <TerminalText style={styles.drawTitle} tone="text" variant="body">
                {sponsorConfirmed
                  ? `${formatCampaignCurrency(economics.prizeDrawAmount)} PAYOUT POOL`
                  : 'PRIZE DETAILS PUBLISHED SOON'}
              </TerminalText>
            </View>
            <TerminalText glow tone={sponsorConfirmed ? 'pink' : 'cyan'} variant="button">
              -&gt;
            </TerminalText>
          </HUDBorderBox>
        </Pressable>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function LeaderboardResultRow({
  isCurrentUser,
  multiplier,
  row
}: {
  isCurrentUser: boolean;
  multiplier?: number;
  row: CategoryLeaderboardRow;
}) {
  return (
    <View style={[styles.resultRow, isCurrentUser ? styles.currentUserRow : null]}>
      <TerminalText
        glow={row.rank <= 3}
        style={styles.rankText}
        tone={row.rank <= 3 ? 'cyan' : 'muted'}
        variant="label"
      >
        {String(row.rank).padStart(2, '0')}
      </TerminalText>
      <View style={styles.resultCopy}>
        <TerminalText style={styles.resultName} tone="text" variant="body">
          {row.alias}
        </TerminalText>
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
    paddingBottom: componentSizes.tabScreenBottomInset,
    backgroundColor: colors.background
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg
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
  standingMetrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg
  },
  standingPending: {
    gap: spacing.sm,
    padding: spacing.md
  },
  standingMetric: {
    flex: 1,
    gap: 2
  },
  standingValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.valueLarge,
    lineHeight: 36
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.divider
  },
  categorySection: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 8,
    backgroundColor: colors.surfaceInteractive
  },
  categoryOption: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    ...interactionStates.webFocus
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
    borderColor: colors.divider
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
    borderColor: colors.divider
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
  resultName: {
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
    padding: spacing.md
  },
  winnersButton: {
    marginTop: spacing.md
  },
  pressableCard: {
    width: '100%',
    ...interactionStates.webFocus
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
    ...interactionStates.pressed
  }
});
