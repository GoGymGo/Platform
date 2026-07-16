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
      'CHOOSE 1 TO 7 VERIFIED WORKOUT DAYS PER WEEK. HIGHER COMMITMENTS CAN EARN MORE ENTRIES WHEN COMPLETED.',
    tone: 'cyan'
  },
  {
    value: 'x2',
    label: 'YOU + WEEKLY CHALLENGE PARTNER BOTH SUCCEED',
    description:
      'WHEN YOU AND YOUR WEEKLY CHALLENGE PARTNER BOTH HIT THE SAME WEEKLY GOAL, YOU BOTH RECEIVE THE 2X WEEKLY CHALLENGE BONUS.',
    tone: 'cyan'
  },
  {
    value: 'x3',
    label: 'WEEKLY CHALLENGE PARTNER MISSES + YOU DO EXTRA DAY',
    description:
      'IF YOUR WEEKLY CHALLENGE PARTNER MISSES, ONE EXTRA VERIFIED WORKOUT ACTIVATES YOUR 3X WEEKLY CHALLENGE BONUS. 3X IS AUTOMATIC WHEN YOUR GOAL ALREADY USES EVERY AVAILABLE DAY.',
    tone: 'pink'
  },
  {
    value: 'x10',
    label: 'PERFECT MONTH',
    description:
      'THE 10X PERFECT-MONTH BONUS APPLIES TO ALL PRIZE DRAW ENTRIES EARNED ACROSS THE FOUR SCORING WEEKS, INCLUDING WEEKLY CHALLENGE BONUSES, CATEGORY-FINISH BONUSES AND BONUS DAYS 29-31.',
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
      label: 'TOP THREE CATEGORY FINISHERS',
      description: 'THE TOP THREE FINISHERS IN EACH COMMITMENT CATEGORY MULTIPLY THEIR ACTUAL FOUR-WEEK TOTAL AFTER 1X, 2X OR 3X WEEKLY CHALLENGE RESULTS. BONUS DAYS 29-31 ARE ADDED NEXT, THEN PERFECT-MONTH 10X IS APPLIED LAST.',
      tone: 'pink'
    },
    ...bonusRules.slice(3),
    {
      value: `+${weeklyGoal} / DAY`,
      label: 'BONUS DAYS 29-31',
      description: `WHEN THE MONTH HAS DAYS 29-31, EACH VERIFIED BONUS DAY ADDS ${weeklyGoal} PRIZE DRAW ${weeklyGoal === 1 ? 'ENTRY' : 'ENTRIES'}, EQUAL TO YOUR SELECTED WEEKLY GOAL, BEFORE THE FINAL PERFECT-MONTH 10X.`,
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
          <TerminalText style={styles.body} tone="muted" variant="body">
            ENTRIES ARE EARNED THROUGH VERIFIED WORKOUTS. BONUS MULTIPLIERS
            REWARD STRONGER COMMITMENTS, WEEKLY CHALLENGE ACCOUNTABILITY, AND PERFECT
            MONTHS.
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
          <TerminalText style={styles.calloutCopy} tone="muted" variant="body">
            BOTH HIT THE GOAL: YOU BOTH EARN 2X. IF YOUR WEEKLY CHALLENGE PARTNER MISSES: COMPLETE
            ONE EXTRA VERIFIED WORKOUT TO EARN 3X. SEVEN-DAY PLAYERS ACTIVATE
            3X AUTOMATICALLY WHEN THEIR WEEKLY CHALLENGE PARTNER MISSES.
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
