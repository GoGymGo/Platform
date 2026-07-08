import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

type PrizeStat = {
  label: string;
  value: string;
};

type OddsRow = {
  accent: boolean;
  label: string;
  value: string;
  width: `${number}%`;
};

const prizeStats: readonly PrizeStat[] = [
  { value: '180', label: 'WINNERS' },
  { value: '$10+', label: 'MIN PRIZE' },
  { value: '1', label: 'YOUR ENTRY' }
];

const oddsRows: readonly OddsRow[] = [
  { label: 'SIGNUP ENTRY // BASELINE', value: '1 ENTRY', width: '18%', accent: false },
  { label: 'VERIFIED WORKOUT ENTRIES', value: '0 ENTRIES', width: '2%', accent: true }
];

export default function DrawScreen() {
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
          <CyberButtonOutline
            label="BACK"
            onPress={() => router.back()}
            style={styles.backButton}
          />
          <TerminalText style={styles.headerLabel} tone="dim" variant="label">
            CURRENT REGIONAL PRIZE DRAW
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.prizePanel} tone="pink">
          <TerminalText glow tone="pink" variant="label">
            GUARANTEED PRIZE POOL
          </TerminalText>
          <TerminalText glow style={styles.prizeValue} tone="text" variant="display">
            $5,000
          </TerminalText>
          <TerminalText style={styles.prizeMeta} tone="muted" variant="micro">
            CAD // 180 WINNERS // FUNDED BY VOLT
          </TerminalText>
          <View style={styles.prizeStats}>
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
          </View>
        </HUDBorderBox>

        <HUDBorderBox style={styles.oddsPanel} tone="cyan">
          <View style={styles.oddsHeader}>
            <TerminalText glow style={styles.oddsPulse} tone="cyan" variant="label">
              ENTRY
            </TerminalText>
            <TerminalText glow style={styles.oddsTitle} tone="pink" variant="label">
              WEIGHTED PRIZE DRAW // WHAT MOVES ODDS
            </TerminalText>
          </View>
          <View style={styles.oddsList}>
            {oddsRows.map((row) => (
              <OddsProgressRow key={row.label} row={row} />
            ))}
          </View>
          <TerminalText style={styles.auditLine} tone="dim" variant="micro">
            PRIZE DRAW RUNS AT MONTH END // OFFICIAL RULES APPLY // NO
            PURCHASE NECESSARY
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.payoutNote} tone="cyan">
          <TerminalText glow style={styles.payoutMark} tone="cyan" variant="label">
            WIN
          </TerminalText>
          <TerminalText style={styles.payoutCopy} tone="cyan" variant="body">
            IF YOU WIN, GOGYMGO GUIDES YOU THROUGH STRIPE PAYOUT VERIFICATION.
            THIS STAYS SEPARATE FROM YOUR PUBLIC PROFILE.
          </TerminalText>
        </HUDBorderBox>
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

function OddsProgressRow({ row }: { row: OddsRow }) {
  const tone = row.accent ? 'cyan' : 'muted';

  return (
    <View>
      <View style={styles.oddsRowHeader}>
        <TerminalText style={styles.oddsRowLabel} tone="muted" uppercase={false} variant="body">
          {row.label}
        </TerminalText>
        <TerminalText glow={row.accent} style={styles.oddsRowValue} tone={tone} variant="body">
          {row.value}
        </TerminalText>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: row.width },
            row.accent ? styles.progressFillAccent : styles.progressFillMuted
          ]}
        />
      </View>
    </View>
  );
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
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  backButton: {
    width: 96,
    minHeight: 40,
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
  oddsPanel: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  oddsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md
  },
  oddsPulse: {
    fontFamily: fontFamilies.display
  },
  oddsTitle: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  oddsList: {
    gap: 11
  },
  oddsRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 5
  },
  oddsRowLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  oddsRowValue: {
    fontFamily: fontFamilies.display
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  progressFillAccent: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  progressFillMuted: {
    backgroundColor: colors.dim
  },
  auditLine: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal
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
    fontFamily: fontFamilies.terminal
  }
});
