import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BrandVideoAdPlaceholder } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type LeaderboardTone = 'cyan' | 'pink' | 'muted';

type LeaderboardRow = {
  avatarColor: string;
  entries: string;
  name: string;
  odds: string;
  rank: string;
  tier: string;
};

const leaderboardRows: readonly LeaderboardRow[] = [
  { rank: '01', name: 'NeonViper', tier: 'DIAMOND', entries: '4,820', odds: '2.1%', avatarColor: colors.pink },
  { rank: '02', name: 'Kira_Flux', tier: 'DIAMOND', entries: '4,510', odds: '1.9%', avatarColor: colors.cyan },
  { rank: '03', name: 'Bolt_Runner', tier: 'PLATINUM', entries: '4,190', odds: '1.8%', avatarColor: colors.cyan },
  { rank: '04', name: 'Mara_V', tier: 'PLATINUM', entries: '3,980', odds: '1.7%', avatarColor: colors.pink },
  { rank: '05', name: 'Jax_540', tier: 'GOLD', entries: '3,640', odds: '1.5%', avatarColor: colors.cyan }
];

export default function LeaderboardScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <TerminalText glow tone="cyan" variant="label">
              REGIONAL RANKS
            </TerminalText>
            <TerminalText glow style={styles.title} tone="cyan" uppercase variant="title">
              TORONTO // CURRENT PRIZE DRAW
            </TerminalText>
          </View>
          <HUDBorderBox style={styles.tierBadge} tone="cyan">
            <TerminalText glow tone="cyan" variant="micro">
              NEW MEMBER
            </TerminalText>
          </HUDBorderBox>
        </View>

        <BrandVideoAdPlaceholder
          compact
          eventLabel="REGIONAL RANK VIEW"
          onPress={() => router.push('/sponsor-offer')}
          placementLabel="LEADERBOARD"
          style={styles.videoAd}
          tone="cyan"
        />

        <HUDBorderBox glow style={styles.myRankCard} tone="cyan">
          <View style={styles.myRankRow}>
            <TerminalText glow style={styles.myRankNumber} tone="cyan" variant="value">
              --
            </TerminalText>
            <View style={styles.myRankCopy}>
              <TerminalText style={styles.myName} tone="text" uppercase variant="body">
                GHOST_RUNNER
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                1 SIGNUP ENTRY
              </TerminalText>
            </View>
            <View style={styles.myOddsBlock}>
              <TerminalText glow style={styles.myOdds} tone="pink" variant="value">
                NEW
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                STARTER
              </TerminalText>
            </View>
          </View>
          <View style={styles.tierProgressTrack}>
            <View style={styles.tierProgressFill} />
          </View>
          <TerminalText style={styles.tierProgressText} tone="dim" variant="micro">
            COMPLETE YOUR FIRST VERIFIED SESSION TO ENTER THE RANK TABLE.
          </TerminalText>
        </HUDBorderBox>

        <TerminalText style={styles.periodLabel} tone="dim" variant="label">
          REGIONAL LEADERS
        </TerminalText>
        <View style={styles.rowList}>
          {leaderboardRows.map((row) => (
            <LeaderboardResultRow key={row.rank} row={row} />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/leaderboard/draw')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox glow style={styles.drawCard} tone="pink">
            <View style={styles.drawCopy}>
              <TerminalText glow tone="pink" variant="micro">
                PRIZE DRAW // MONTHLY
              </TerminalText>
              <TerminalText style={styles.drawTitle} tone="text" uppercase variant="body">
                VIEW THE CURRENT PRIZE DRAW -&gt;
              </TerminalText>
            </View>
            <TerminalText glow tone="pink" variant="button">
              -&gt;
            </TerminalText>
          </HUDBorderBox>
        </Pressable>

        <CyberButtonOutline
          label="BACK"
          onPress={() => router.push('/home')}
          style={styles.backButton}
          tone="cyan"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function SponsorBanner() {
  return (
    <HUDBorderBox style={styles.sponsorBanner} tone="muted">
      <View style={styles.sponsorMark}>
        <TerminalText glow tone="pink" variant="title">
          V
        </TerminalText>
      </View>
      <View style={styles.sponsorCopy}>
        <TerminalText tone="dim" variant="micro">
          SPONSOR SIGNAL
        </TerminalText>
        <TerminalText style={styles.sponsorTitle} tone="text" variant="body">
          SPONSORED BY VOLT
        </TerminalText>
        <TerminalText tone="muted" variant="body">
          PRIZE POOL PARTNER
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

function LeaderboardResultRow({ row }: { row: LeaderboardRow }) {
  const initials = row.name.slice(0, 2).toUpperCase();
  const rankTone = getRankTone(row.rank);
  const boxTone = rankTone === 'muted' ? 'muted' : rankTone;

  return (
    <HUDBorderBox glow={row.rank === '01'} style={styles.resultRow} tone={boxTone}>
      <TerminalText glow={rankTone !== 'muted'} style={styles.rankText} tone={rankTone} variant="label">
        {row.rank}
      </TerminalText>
      <View style={[styles.resultAvatar, { backgroundColor: row.avatarColor }]}>
        <TerminalText style={styles.resultAvatarText} tone="dim" variant="button">
          {initials}
        </TerminalText>
      </View>
      <View style={styles.resultCopy}>
        <TerminalText style={styles.resultName} tone="text" uppercase variant="body">
          {row.name}
        </TerminalText>
        <TerminalText tone="muted" variant="micro">
          {row.tier}
        </TerminalText>
      </View>
      <View style={styles.resultMetric}>
        <TerminalText style={styles.resultEntries} tone="cyan" variant="body">
          {row.entries}
        </TerminalText>
        <TerminalText glow tone="pink" variant="micro">
          {row.odds} EST. ODDS
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

function getRankTone(rank: string): LeaderboardTone {
  if (rank === '01') {
    return 'pink';
  }

  if (rank === '02' || rank === '03') {
    return 'cyan';
  }

  return 'muted';
}

const styles = StyleSheet.create({
  sponsorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  sponsorMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 8,
    backgroundColor: colors.surfacePinkSoft
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
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
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  headerCopy: {
    flex: 1
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  videoAd: {
    marginBottom: spacing.lg
  },
  tierBadge: {
    width: 'auto',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  myRankCard: {
    marginBottom: spacing.lg,
    padding: 18
  },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  myRankNumber: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.valueLarge,
    lineHeight: 36
  },
  myRankCopy: {
    flex: 1
  },
  myName: {
    fontFamily: fontFamilies.display
  },
  myOddsBlock: {
    alignItems: 'flex-end'
  },
  myOdds: {
    fontFamily: fontFamilies.display
  },
  tierProgressTrack: {
    height: 6,
    overflow: 'hidden',
    marginTop: 14,
    borderRadius: 4,
    backgroundColor: colors.whiteAlpha07
  },
  tierProgressFill: {
    width: '34%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  tierProgressText: {
    marginTop: 7,
    fontFamily: fontFamilies.terminal
  },
  periodLabel: {
    marginHorizontal: spacing.xs,
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  rowList: {
    gap: 9
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 14
  },
  rankText: {
    width: 26,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  resultAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  resultAvatarText: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  resultCopy: {
    flex: 1
  },
  resultName: {
    fontFamily: fontFamilies.terminal
  },
  resultMetric: {
    alignItems: 'flex-end'
  },
  resultEntries: {
    fontFamily: fontFamilies.display
  },
  pressableCard: {
    width: '100%'
  },
  drawCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 14,
    padding: 15,
    borderStyle: 'dashed'
  },
  drawCopy: {
    flex: 1
  },
  drawTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.terminal
  },
  backButton: {
    marginTop: spacing.lg
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
