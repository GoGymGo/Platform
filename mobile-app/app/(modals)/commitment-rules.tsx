import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing } from '@/constants/theme';

type RuleTone = 'cyan' | 'pink';

type CommitmentRule = {
  body: string;
  index: string;
  tone: RuleTone;
  title: string;
};

const commitmentRules: readonly CommitmentRule[] = [
  {
    index: '01',
    title: 'PICK YOUR DAYS',
    body: 'CHOOSE 1 TO 7 VERIFIED WORKOUT DAYS PER WEEK FOR THE MONTH.',
    tone: 'cyan'
  },
  {
    index: '02',
    title: 'COMMITMENT LOCKS',
    body: 'YOUR MONTHLY COMMITMENT LOCKS SUNDAY AT 11:59 PM FOR THE UPCOMING PRIZE DRAW PERIOD.',
    tone: 'cyan'
  },
  {
    index: '03',
    title: 'VERIFY SESSIONS',
    body: 'HEART-RATE DEVICE OR PARTNER GYM QR SESSIONS MUST INCLUDE QUICK IDENTITY CHECKS.',
    tone: 'cyan'
  },
  {
    index: '04',
    title: 'WEEKLY 2X BONUS',
    body: 'IF YOU AND YOUR MATCH BOTH HIT THE WEEKLY GOAL, YOU BOTH EARN 2X BONUS ENTRIES.',
    tone: 'cyan'
  },
  {
    index: '05',
    title: 'MAKE-UP 3X BONUS',
    body: 'IF YOUR MATCH MISSES, COMPLETE ONE EXTRA VERIFIED WORKOUT TO EARN 3X AND CLAIM THEIR UNEARNED BONUS ENTRIES.',
    tone: 'pink'
  },
  {
    index: '06',
    title: 'ENTRIES AFFECT ODDS',
    body: 'MORE VERIFIED ENTRIES IMPROVE YOUR ESTIMATED MONTHLY PRIZE DRAW ODDS.',
    tone: 'cyan'
  }
];

export default function CommitmentRulesModal() {
  const router = useRouter();

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
          COMMITMENT RULES
        </TerminalText>
        <CyberButtonOutline
          label="CLOSE"
          onPress={() => router.back()}
          style={styles.closeButton}
        />
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            LOCK YOUR{'\n'}MONTH CLEARLY.
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" variant="body">
            THE COMMITMENT SCREEN SHOWS THE ENTRY POTENTIAL FOR YOUR SELECTED
            WEEKLY GOAL. THESE RULES EXPLAIN HOW THAT CHOICE BECOMES ELIGIBLE.
          </TerminalText>
        </View>

        <View style={styles.rulesList}>
          {commitmentRules.map((rule) => (
            <RuleRow key={rule.index} rule={rule} />
          ))}
        </View>

        <HUDBorderBox glow style={styles.summaryCard} tone="cyan">
          <TerminalText style={styles.summaryLabel} tone="muted" variant="label">
            CURRENT PRIZE DRAW
          </TerminalText>
          <TerminalText glow style={styles.summaryValue} tone="cyan" variant="title">
            $5,000 CAD - 180 WINNERS
          </TerminalText>
          <TerminalText style={styles.summaryCopy} tone="muted" variant="body">
            HIT YOUR WEEKLY GOAL TO UNLOCK PRIZE DRAW ENTRIES. COMPLETE THE
            FULL MONTH TO QUALIFY FOR THE 10X PERFECT-MONTH MULTIPLIER.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="BACK TO COMMITMENT ->"
          onPress={() => router.back()}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function RuleRow({ rule }: { rule: CommitmentRule }) {
  return (
    <HUDBorderBox glow={rule.tone === 'pink'} style={styles.ruleRow} tone={rule.tone}>
      <View style={styles.ruleIndexBox}>
        <TerminalText glow tone={rule.tone} variant="label">
          {rule.index}
        </TerminalText>
      </View>
      <View style={styles.ruleCopy}>
        <TerminalText glow style={styles.ruleTitle} tone={rule.tone} variant="label">
          {rule.title}
        </TerminalText>
        <TerminalText style={styles.ruleBody} tone="muted" variant="body">
          {rule.body}
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCyanSubtle
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  closeButton: {
    width: 104,
    minHeight: 40,
    paddingVertical: spacing.sm
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  title: {
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  rulesList: {
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  ruleIndexBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanMuted,
    borderRadius: 10,
    backgroundColor: colors.backgroundAlpha72
  },
  ruleCopy: {
    flex: 1
  },
  ruleTitle: {
    fontFamily: fontFamilies.terminal
  },
  ruleBody: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  summaryCard: {
    marginBottom: spacing.xl,
    borderStyle: 'dashed'
  },
  summaryLabel: {
    fontFamily: fontFamilies.terminal
  },
  summaryValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  summaryCopy: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal
  }
});
