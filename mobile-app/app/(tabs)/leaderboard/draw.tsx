import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { calculateRankedPrizeDrawPayouts } from '@/domain/campaignEconomics';
import { goBackOrReplace } from '@/navigation/goBack';
import {
  formatCampaignCurrency,
  formatCampaignDate,
  useSponsorCampaign
} from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

type PrizeStat = {
  label: string;
  value: string;
};

type PayoutRow = {
  amount: string;
  label: string;
  rank: number;
};

export default function DrawScreen() {
  const router = useRouter();
  const [showEntryDetails, setShowEntryDetails] = useState(false);
  const [showPayoutDetails, setShowPayoutDetails] = useState(false);
  const { campaign, economics } = useSponsorCampaign();
  const sponsorConfirmed = campaign.status === 'approved';
  const {
    competition,
    competitionEntries,
    signupEntries,
    totalEntries
  } = useWorkoutProgress();
  const competitionNotStarted = competition.phase === 'before-month';
  const competitionStartLabel = formatCampaignDate(`${competition.competitionMonthKey}-01`);
  const [competitionYear, competitionMonth] = competition.competitionMonthKey.split('-').map(Number);
  const competitionMonthLabel = new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(competitionYear, competitionMonth - 1, 1, 12));
  const rankedPayouts = calculateRankedPrizeDrawPayouts(
    economics.prizeDrawAmount,
    economics.prizeDrawWinnerCount,
    campaign.economics.prizeDrawPayoutExponent
  );
  const payoutRows = buildPayoutRows(rankedPayouts);
  const prizeStats: readonly PrizeStat[] = sponsorConfirmed
    ? [
        { value: economics.prizeDrawWinnerCount.toLocaleString(), label: 'PROJECTED WINNERS' },
        { value: formatCampaignCurrency(economics.prizeDrawTopPayout), label: 'PROJECTED TOP PRIZE' },
        { value: formatCampaignCurrency(economics.prizeDrawMinimumPayout), label: 'PROJECTED MINIMUM' }
      ]
    : [];

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/leaderboard')}
            style={styles.backButton}
          />
          <TerminalText style={styles.headerLabel} tone="dim" variant="label">
            {campaign.region}{' // '}{competitionMonthLabel}
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.prizePanel} tone={sponsorConfirmed ? 'pink' : 'cyan'}>
          <TerminalText glow tone={sponsorConfirmed ? 'pink' : 'cyan'} variant="label">
            REGIONAL PRIZE DRAW
          </TerminalText>
          <TerminalText
            glow
            style={[styles.prizeValue, !sponsorConfirmed ? styles.pendingPrizeValue : null]}
            tone="text"
            variant="display"
          >
            {sponsorConfirmed ? formatCampaignCurrency(economics.prizeDrawAmount) : 'PRIZE DETAILS PUBLISHED SOON'}
          </TerminalText>
          <TerminalText style={styles.prizeMeta} tone="muted" variant="micro">
            {sponsorConfirmed
              ? `CAD // 15% OF PLAYERS GET PAID // FUNDED BY ${campaign.sponsor.shortName}`
              : '15% OF PLAYERS GET PAID // FINAL AMOUNTS PUBLISHED BEFORE THE COMPETITION'}
          </TerminalText>
          {prizeStats.length > 0 ? <View style={styles.prizeStats}>
            {prizeStats.map((stat) => (
              <HUDBorderBox key={stat.label} style={styles.prizeStatCard} tone="muted">
                <TerminalText glow style={styles.prizeStatValue} tone="cyan" variant="body">
                  {stat.value}
                </TerminalText>
                <TerminalText style={styles.prizeStatLabel} tone="muted" variant="micro">
                  {stat.label}
                </TerminalText>
              </HUDBorderBox>
            ))}
          </View> : null}
          {sponsorConfirmed ? (
            <TerminalText style={styles.projectionBasis} tone="muted" uppercase={false} variant="caption">
              Projections are based on {economics.totalVerifiedUsers.toLocaleString()} eligible players in this regional campaign.
            </TerminalText>
          ) : null}
        </HUDBorderBox>

        <HUDBorderBox style={styles.entryPanel} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            YOUR PRIZE DRAW STATUS
          </TerminalText>
          <View style={styles.entrySummary}>
            <EntrySummaryRow label="FREE ENTRY" value={`${signupEntries} SECURED`} />
            <EntrySummaryRow
              label="COMPETITION ENTRIES"
              value={competitionNotStarted ? 'STARTS SOON' : String(competitionEntries)}
            />
            <EntrySummaryRow label="TOTAL ENTRIES" value={String(totalEntries)} tone="pink" />
          </View>
          <TerminalText style={styles.entryStatusCopy} tone="muted" uppercase={false} variant="body">
            {competitionNotStarted
              ? `Your free entry is active. Competition scoring begins ${competitionStartLabel}.`
              : 'More Prize Draw Entries improve your chance of being selected for a payout.'}
          </TerminalText>
          <CyberButtonOutline
            label={showEntryDetails ? 'HIDE HOW ENTRIES GROW' : 'HOW ENTRIES GROW'}
            onPress={() => setShowEntryDetails((current) => !current)}
            style={styles.entryDetailsButton}
          />
          {showEntryDetails ? (
            <HUDBorderBox style={styles.entryDetails} tone="muted">
              <TerminalText glow tone="cyan" variant="label">
                MATCH + CATEGORY + PERFECT MONTH
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Weekly Period Matches can earn 2x or 3x. The top three in each
                commitment category earn {campaign.economics.categoryPodiumMultipliers[1]}x,{' '}
                {campaign.economics.categoryPodiumMultipliers[2]}x or{' '}
                {campaign.economics.categoryPodiumMultipliers[3]}x. Complete all four
                scoring weeks and the Perfect Month 10x is applied last.
              </TerminalText>
              <TerminalText tone="dim" uppercase={false} variant="caption">
                Your free signup entry is added once and is never multiplied.
              </TerminalText>
            </HUDBorderBox>
          ) : null}
        </HUDBorderBox>

        {sponsorConfirmed ? (
          <CyberButtonOutline
            label={showPayoutDetails ? 'HIDE PAYOUT DETAILS' : 'HOW PAYOUTS WORK'}
            onPress={() => setShowPayoutDetails((current) => !current)}
            style={styles.detailsButton}
            tone="cyan"
          />
        ) : null}

        {sponsorConfirmed && showPayoutDetails ? (
          <>
            <HUDBorderBox style={styles.ladderPanel} tone="pink">
              <TerminalText glow tone="pink" variant="label">
                HOW PAYOUTS ARE SHARED
              </TerminalText>
              <TerminalText style={styles.ladderIntro} tone="muted" uppercase={false} variant="body">
                The Prize Draw selects {economics.prizeDrawWinnerCount.toLocaleString()} players.
                Earlier selections receive larger cash payouts, and every selected
                player receives a prize.
              </TerminalText>
              <View style={styles.ladderRows}>
                {payoutRows.map((row) => (
                  <View key={row.rank} style={styles.ladderRow}>
                    <View style={styles.ladderRankBlock}>
                      <TerminalText glow tone={row.rank === 1 ? 'pink' : 'cyan'} variant="body">
                        #{row.rank.toLocaleString()}
                      </TerminalText>
                      <TerminalText tone="dim" variant="micro">
                        {row.label}
                      </TerminalText>
                    </View>
                    <TerminalText glow style={styles.ladderAmount} tone="text" variant="body">
                      {row.amount}
                    </TerminalText>
                  </View>
                ))}
              </View>
              <TerminalText style={styles.curveNote} tone="dim" variant="micro">
                CURRENT CURVE {'//'} {campaign.economics.prizeDrawPayoutExponent.toFixed(2)} EXPONENT
                {' // '}ADJUSTABLE BEFORE THE MONTH OPENS {'//'} COMPLETE POOL PAID TO THE CENT
              </TerminalText>
            </HUDBorderBox>

            <HUDBorderBox style={styles.payoutNote} tone="cyan">
              <TerminalText glow style={styles.payoutMark} tone="cyan" variant="label">
                WIN
              </TerminalText>
              <TerminalText style={styles.payoutCopy} tone="cyan" uppercase={false} variant="body">
                Top-three category multipliers improve selection odds only.
                After selection, selection order sets the prize. GoGymGo then guides
                winners through private Hyperwallet payout verification.
              </TerminalText>
            </HUDBorderBox>
          </>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function buildPayoutRows(
  payouts: ReturnType<typeof calculateRankedPrizeDrawPayouts>
): readonly PayoutRow[] {
  const winnerCount = payouts.length;

  if (winnerCount === 0) {
    return [];
  }

  const ranks = Array.from(
    new Set([
      1,
      Math.max(1, Math.ceil(winnerCount * 0.01)),
      Math.max(1, Math.ceil(winnerCount * 0.1)),
      winnerCount
    ])
  );

  return ranks.map((rank) => {
    const payout = payouts[rank - 1];
    const label =
      rank === 1
        ? 'FIRST DRAWN'
        : rank === winnerCount
          ? 'FINAL PAID'
          : rank === Math.ceil(winnerCount * 0.01)
            ? 'TOP 1% OF DRAW ORDER'
            : 'TOP 10% OF DRAW ORDER';

    return {
      amount: formatCampaignCurrency(payout.amount),
      label,
      rank
    };
  });
}

function EntrySummaryRow({
  label,
  tone = 'cyan',
  value
}: {
  label: string;
  tone?: 'cyan' | 'pink';
  value: string;
}) {
  return (
    <View style={styles.entrySummaryRow}>
      <TerminalText tone="muted" variant="body">
        {label}
      </TerminalText>
      <TerminalText glow tone={tone} variant="body">
        {value}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  prizePanel: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: 26,
    paddingHorizontal: 22
  },
  prizeValue: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.prize,
    lineHeight: 54
  },
  prizeMeta: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  prizeStats: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18
  },
  prizeStatCard: {
    flex: 1,
    alignItems: 'center',
    padding: 11,
    borderRadius: radii.md
  },
  prizeStatValue: {
    fontFamily: fontFamilies.display
  },
  prizeStatLabel: {
    marginTop: 2,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  entryPanel: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  projectionBasis: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  entrySummary: {
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  entrySummaryRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCyanSubtle
  },
  entryStatusCopy: {
    fontFamily: fontFamilies.body
  },
  entryDetailsButton: {
    minHeight: 44
  },
  entryDetails: {
    gap: spacing.sm,
    padding: spacing.md
  },
  ladderPanel: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  detailsButton: {
    marginBottom: spacing.lg
  },
  ladderIntro: {
    fontFamily: fontFamilies.body
  },
  ladderRows: {
    borderTopWidth: 1,
    borderTopColor: colors.whiteAlpha07
  },
  ladderRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteAlpha07
  },
  ladderRankBlock: {
    flex: 1
  },
  ladderAmount: {
    fontFamily: fontFamilies.display
  },
  curveNote: {
    fontFamily: fontFamilies.terminal
  },
  pendingPrizeValue: {
    fontSize: fontSizes.screenTitle,
    lineHeight: 36,
    textAlign: 'center'
  },
  payoutNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderStyle: 'dashed'
  },
  payoutMark: {
    fontFamily: fontFamilies.display
  },
  payoutCopy: {
    flex: 1,
    fontFamily: fontFamilies.body
  }
});
