import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

type EntryTone = 'cyan' | 'pink' | 'muted';

type EntryStat = {
  active: boolean;
  label: string;
  tone: EntryTone;
  value: string;
};

const entryStats: readonly EntryStat[] = [
  { active: true, label: 'CURRENT ENTRY', tone: 'cyan', value: '1' },
  { active: false, label: 'BONUS ENTRIES', tone: 'pink', value: '0' },
  { active: false, label: 'DAY GOAL', tone: 'muted', value: '4' }
];

export default function EntryConfirmedScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <TerminalText tone="dim" variant="label">
            STEP COMPLETE
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            ENTRY CONFIRMED
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.ticketRingOuter}>
          <View style={styles.ticketRingMiddle}>
            <HUDBorderBox glow style={styles.ticketCore} tone="cyan">
              <TerminalText glow style={styles.ticketText} tone="cyan" variant="label">
                ENTRY
              </TerminalText>
            </HUDBorderBox>
          </View>
        </View>

        <TerminalText glow style={styles.eyebrow} tone="cyan" variant="label">
          ENTRY CONFIRMED
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" uppercase variant="title">
          YOU'RE IN THE CURRENT PRIZE DRAW
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          1 FREE ENTRY SECURED. NO WORKOUT REQUIRED. VERIFIED WORKOUTS ADD
          ENTRIES THAT IMPROVE YOUR ODDS.
        </TerminalText>

        <View style={styles.statsRow}>
          {entryStats.map((stat) => (
            <EntryStatCard key={stat.label} stat={stat} />
          ))}
        </View>

        <HUDBorderBox style={styles.nextPanel} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            NEXT SIGNAL
          </TerminalText>
          <TerminalText style={styles.nextCopy} tone="muted" variant="body">
            ENTER THE APP TO SEE YOUR HOME BASE, CREATOR WORKOUTS, SPONSOR
            REWARDS AND SESSION START.
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="ENTER GOGYMGO ->"
            onPress={() => router.replace('/home')}
          />
        </View>
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

function EntryStatCard({ stat }: { stat: EntryStat }) {
  const cardTone = stat.tone === 'muted' ? 'muted' : stat.tone;
  const textTone = stat.tone === 'muted' ? 'dim' : stat.tone;

  return (
    <HUDBorderBox
      glow={stat.active}
      style={[styles.statCard, stat.active ? styles.statCardActive : null]}
      tone={cardTone}
    >
      <TerminalText glow={stat.active} style={styles.statValue} tone={textTone} variant="value">
        {stat.value}
      </TerminalText>
      <TerminalText style={styles.statLabel} tone="muted" variant="micro">
        {stat.label}
      </TerminalText>
    </HUDBorderBox>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  stepHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  progressTrack: {
    width: '100%',
    height: 3,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  ticketRingOuter: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanLight,
    borderRadius: 70,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    ...cyberGlow.cyan
  },
  ticketRingMiddle: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderPinkSoft,
    borderRadius: 56
  },
  ticketCore: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: radii.lg
  },
  ticketText: {
    fontFamily: fontFamilies.display
  },
  eyebrow: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  title: {
    maxWidth: 320,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.value,
    lineHeight: 36,
    textAlign: 'center'
  },
  body: {
    maxWidth: 310,
    fontFamily: fontFamilies.terminal,
    lineHeight: 22,
    marginTop: 14,
    textAlign: 'center'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: spacing.xxl,
    marginBottom: spacing.lg
  },
  statCard: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md
  },
  statCardActive: {
    backgroundColor: colors.surfaceCyanSoft
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 30
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  nextPanel: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg
  },
  nextCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  actions: {
    width: '100%',
    marginTop: spacing.xs
  }
});
