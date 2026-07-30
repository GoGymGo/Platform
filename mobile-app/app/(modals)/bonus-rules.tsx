import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

type RuleTone = 'cyan' | 'pink';

type BonusRule = {
  description: string;
  label: string;
  tone: RuleTone;
  value: string;
};

const bonusRules: readonly BonusRule[] = [
  {
    value: '1-7 DAYS',
    label: 'HIT YOUR GOAL BY DAYS PICKED',
    description:
      'Choose 1 to 7 verified workout days per week. Higher Weekly Goals can earn more entries when completed.',
    tone: 'cyan'
  },
  {
    value: 'x2',
    label: 'YOU + WEEKLY CHALLENGE PARTNER BOTH SUCCEED',
    description:
      'When you and your Weekly Challenge partner both hit the same goal, you both receive the 2x weekly bonus.',
    tone: 'cyan'
  },
  {
    value: 'x3',
    label: 'WEEKLY CHALLENGE PARTNER MISSES + YOU DO EXTRA DAY',
    description:
      'If your partner misses, one extra verified workout activates your 3x bonus. The bonus is automatic when your goal already uses every available day.',
    tone: 'pink'
  },
  {
    value: 'x10',
    label: 'PERFECT MONTH',
    description:
      'The 10x Perfect Month bonus applies after all four scoring weeks, including Weekly Challenge, goal-group and Bonus Day entries.',
    tone: 'pink'
  }
];

export default function BonusRulesModal() {
  const router = useRouter();
  const { campaign } = useSponsorCampaign();
  const { weeklyGoal } = useWorkoutProgress();
  const rulesWithCategoryWinners: readonly BonusRule[] = [
    ...bonusRules.slice(0, 3),
    {
      value: `${campaign.economics.categoryPodiumMultipliers[1]}x / ${campaign.economics.categoryPodiumMultipliers[2]}x / ${campaign.economics.categoryPodiumMultipliers[3]}x`,
      label: 'TOP THREE GOAL-GROUP FINISHERS',
      description: 'The top three finishers in each Weekly Goal group multiply their four-week total. Bonus Days are added next, then Perfect Month 10x is applied last.',
      tone: 'pink'
    },
    ...bonusRules.slice(3),
    {
      value: `+${weeklyGoal} / DAY`,
      label: 'BONUS DAYS 29-31',
      description: `When the month has days 29-31, each verified Bonus Day adds ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'} before the final Perfect Month 10x.`,
      tone: 'pink'
    }
  ];

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
          BONUS RULES
        </TerminalText>
        <CyberButtonOutline
          label="CLOSE"
          onPress={() => goBackOrReplace(router, '/how-it-works')}
          style={styles.closeButton}
        />
      </View>

      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            HOW ENTRIES{'\n'}MULTIPLY.
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Verified workouts earn entries. Consistency, Weekly Challenge
            teamwork and a Perfect Month can multiply them.
          </TerminalText>
        </View>

        <View style={styles.rulesList}>
          {rulesWithCategoryWinners.map((rule) => (
            <RuleCard key={rule.value} rule={rule} />
          ))}
        </View>

        <HUDBorderBox glow style={styles.callout} tone="cyan">
          <TerminalText glow style={styles.calloutLabel} tone="cyan" variant="label">
            WEEKLY CHALLENGE BONUS
          </TerminalText>
          <TerminalText style={styles.calloutCopy} tone="muted" uppercase={false} variant="body">
            Both hit the goal: 2x each. If your partner misses, complete one
            extra verified workout for 3x. The 3x bonus is automatic when no
            extra day is available.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="GOT IT ->"
          onPress={() => goBackOrReplace(router, '/how-it-works')}
        />
      </ScreenScrollView>
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
        <TerminalText style={styles.ruleDescription} tone="muted" uppercase={false} variant="body">
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
    borderBottomColor: colors.surfaceCyanActive
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  closeButton: {
    width: 104,
    minHeight: 44,
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
    fontFamily: fontFamilies.body,
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
    fontFamily: fontFamilies.display
  },
  ruleDescription: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
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
    fontFamily: fontFamilies.body
  }
});
