import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type RuleTone = 'cyan' | 'pink';

type BonusRule = {
  description: string;
  label: string;
  tone: RuleTone;
  value: string;
};

const bonusRules: readonly BonusRule[] = [
  {
    value: '1-7x',
    label: 'HIT YOUR GOAL BY DAYS PICKED',
    description:
      'CHOOSE 1 TO 7 VERIFIED WORKOUT DAYS PER WEEK. HIGHER COMMITMENTS CAN EARN MORE ENTRIES WHEN COMPLETED.',
    tone: 'cyan'
  },
  {
    value: 'x2',
    label: 'YOU + MATCH BOTH SUCCEED',
    description:
      'WHEN BOTH PEOPLE IN A WEEKLY PAIRING HIT THE SAME GOAL, BOTH RECEIVE THE PARTNER BONUS.',
    tone: 'pink'
  },
  {
    value: 'x3',
    label: 'MATCH MISSES + YOU DO EXTRA DAY',
    description:
      'IF YOUR MATCH MISSES, ONE EXTRA VERIFIED WORKOUT CAN CLAIM THEIR UNEARNED BONUS ENTRIES.',
    tone: 'pink'
  },
  {
    value: 'x10',
    label: 'PERFECT MONTH',
    description:
      'COMPLETE THE COMMITTED WEEKLY GOAL ACROSS THE FULL MONTH TO UNLOCK THE PERFECT-MONTH MULTIPLIER.',
    tone: 'cyan'
  }
];

export default function BonusRulesModal() {
  const router = useRouter();

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <TerminalText glow style={styles.headerLabel} tone="pink" variant="label">
          BONUS RULES
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
            HOW ENTRIES{'\n'}MULTIPLY.
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" variant="body">
            ENTRIES ARE EARNED THROUGH VERIFIED WORKOUTS. BONUS MULTIPLIERS
            REWARD STRONGER COMMITMENTS, MATCHED ACCOUNTABILITY, AND PERFECT
            MONTHS.
          </TerminalText>
        </View>

        <View style={styles.rulesList}>
          {bonusRules.map((rule) => (
            <RuleCard key={rule.value} rule={rule} />
          ))}
        </View>

        <HUDBorderBox glow style={styles.callout} tone="cyan">
          <TerminalText glow style={styles.calloutLabel} tone="cyan" variant="label">
            PAIRING BONUS
          </TerminalText>
          <TerminalText style={styles.calloutCopy} tone="muted" variant="body">
            BOTH HIT THE GOAL: YOU BOTH EARN 2X. IF YOUR MATCH MISSES: COMPLETE
            ONE EXTRA VERIFIED WORKOUT TO EARN 3X AND CLAIM THEIR UNEARNED BONUS
            ENTRIES.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary label="GOT IT ->" onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}

function RuleCard({ rule }: { rule: BonusRule }) {
  return (
    <HUDBorderBox glow={rule.tone === 'pink'} style={styles.ruleCard} tone={rule.tone}>
      <View style={styles.ruleValueBox}>
        <TerminalText glow style={styles.ruleValue} tone={rule.tone} variant="title">
          {rule.value}
        </TerminalText>
      </View>
      <View style={styles.ruleCopy}>
        <TerminalText glow style={styles.ruleLabel} tone={rule.tone} variant="label">
          {rule.label}
        </TerminalText>
        <TerminalText style={styles.ruleDescription} tone="muted" variant="body">
          {rule.description}
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
    borderBottomColor: colors.surfacePinkStrong
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
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  ruleValueBox: {
    width: 60,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanMuted,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlpha72
  },
  ruleValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.stat,
    lineHeight: 24,
    textAlign: 'center'
  },
  ruleCopy: {
    flex: 1
  },
  ruleLabel: {
    fontFamily: fontFamilies.terminal
  },
  ruleDescription: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  callout: {
    marginBottom: spacing.xl,
    borderStyle: 'dashed'
  },
  calloutLabel: {
    fontFamily: fontFamilies.terminal
  },
  calloutCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  }
});
