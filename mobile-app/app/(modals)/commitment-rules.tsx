import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, interactionStates, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { formatCampaignCurrency, useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

type RuleTone = 'cyan' | 'pink' | 'amber';

type CommitmentRule = {
  body: string;
  index: string;
  tone: RuleTone;
  title: string;
};

const commitmentRules: readonly CommitmentRule[] = [
  {
    index: '01',
    title: 'REGISTRATION WINDOW',
    body: 'Advance registration opens during the calendar month before the competition. Late registration closes at 11:59 PM on day 6.',
    tone: 'cyan'
  },
  {
    index: '02',
    title: '100 PLAYERS TO LAUNCH',
    body: 'At least 100 players across the region must register by day 1. A campaign may have a sponsor-advised player cap.',
    tone: 'cyan'
  },
  {
    index: '03',
    title: 'PICK YOUR DAYS',
    body: 'Choose 1 to 7 verified workout days per week for the month.',
    tone: 'cyan'
  },
  {
    index: '04',
    title: 'FOUR SCORING WEEKS',
    body: 'The month scores days 1-7, 8-14, 15-21 and 22-28. Your goal is the same in each week.',
    tone: 'cyan'
  },
  {
    index: '05',
    title: 'VERIFY SESSIONS',
    body: 'Heart-rate device or Partner Gym QR sessions must include quick identity checks.',
    tone: 'cyan'
  },
  {
    index: '06',
    title: 'WEEKLY 2X BONUS',
    body: 'If you and your Period Match both hit the Weekly Goal, you both earn the 2x Period Match Bonus for that scoring week.',
    tone: 'cyan'
  },
  {
    index: '07',
    title: 'MAKE-UP 3X BONUS',
    body: 'If your matched player misses, complete one extra verified workout before the scoring week closes to earn the 3x Period Match Bonus.',
    tone: 'pink'
  },
  {
    index: '08',
    title: 'NO EXTRA DAY EXCEPTION',
    body: 'A seven-day player, or a late entrant who fills every day remaining in scoring week 1, receives 3x automatically if their matched player misses.',
    tone: 'amber'
  },
  {
    index: '09',
    title: 'TOP THREE CATEGORY FINISHERS',
    body: 'The Top Three Category Finishers multiply their actual four-week total after Period Match results. Bonus Days 29-31 are added next, then Perfect Month 10x is applied last.',
    tone: 'pink'
  },
  {
    index: '10',
    title: 'BONUS DAYS 29-31',
    body: 'When the month has days 29, 30 or 31, each verified Bonus Day adds the user\'s selected Weekly Goal value before the Perfect Month 10x.',
    tone: 'pink'
  },
  {
    index: '11',
    title: 'PERFECT MONTH // FINAL 10X',
    body: 'The Perfect Month 10x is applied last to the Period Match-adjusted, category-adjusted total plus all Bonus Day entries.',
    tone: 'pink'
  }
];

export default function CommitmentRulesModal() {
  const router = useRouter();
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<string>('01');
  const { campaign, economics, enrollment } = useSponsorCampaign();
  const { weeklyGoal } = useWorkoutProgress();
  const currentRules = commitmentRules.map((rule) =>
    rule.index === '09'
      ? {
          ...rule,
          body: `The Top Three Category Finishers receive ${campaign.economics.categoryPodiumMultipliers[1]}x, ${campaign.economics.categoryPodiumMultipliers[2]}x and ${campaign.economics.categoryPodiumMultipliers[3]}x multipliers on their actual four-week total after Period Match results. Bonus Days 29-31 are added next, then Perfect Month 10x is applied last.`
        }
      : rule.index === '10'
        ? {
            ...rule,
            body: `This competition offers only the Bonus Days that exist after day 28. Each verified Bonus Day adds ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'}, equal to your selected Weekly Goal, before the Perfect Month 10x.`
          }
        : rule
  );

  return (
    <ScreenContainer contentStyle={styles.screen} surface="modal">
      <View style={styles.header}>
        <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
          COMMITMENT RULES
        </TerminalText>
        <CyberButtonOutline
          label="CLOSE"
          onPress={() => goBackOrReplace(router, '/commitment')}
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
            LOCK YOUR{'\n'}MONTH CLEARLY.
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Your selection carries forward each month. Changes for the upcoming
            month lock at 11:59:59 PM on the final day before the competition
            month. Late registration ends at the conclusion of day 6, and
            scoring starts on the registration day.
          </TerminalText>
        </View>

        <View style={styles.rulesList}>
          {currentRules.map((rule) => (
            <RuleRow
              expanded={expandedRuleIndex === rule.index}
              key={rule.index}
              onToggle={() => setExpandedRuleIndex((current) => current === rule.index ? '' : rule.index)}
              rule={rule}
            />
          ))}
        </View>

        <HUDBorderBox glow style={styles.summaryCard} tone="cyan">
          <TerminalText style={styles.summaryLabel} tone="muted" variant="label">
            CURRENT PRIZE DRAW
          </TerminalText>
          <TerminalText glow style={styles.summaryValue} tone="cyan" variant="title">
            {formatCampaignCurrency(economics.prizeDrawAmount)} - {economics.prizeDrawWinnerCount.toLocaleString()} PROJECTED WINNERS
          </TerminalText>
          <TerminalText style={styles.summaryCopy} tone="muted" uppercase={false} variant="body">
            Hit all four Weekly Goals to unlock Prize Draw Entries and apply
            10x. Late registrants use a reduced goal based on days left in
            scoring week 1. The Top Three Category Finishers receive an
            additional month-end multiplier. The regional field requires{' '}
            {enrollment.minimumEntrants} players to launch and keeps late
            registration open through day 6
            {enrollment.maximumEntrants === null
              ? ' without a cap for this campaign.'
              : ` unless the ${enrollment.maximumEntrants.toLocaleString()}-player sponsor cap is reached first.`}
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="BACK TO COMMITMENT ->"
          onPress={() => goBackOrReplace(router, '/commitment')}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function RuleRow({
  expanded,
  onToggle,
  rule
}: {
  expanded: boolean;
  onToggle: () => void;
  rule: CommitmentRule;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.rulePressable,
        pressed ? styles.rulePressed : null
      ]}
    >
      <HUDBorderBox glow={expanded && rule.tone === 'pink'} style={styles.ruleRow} tone={rule.tone}>
        <View style={styles.ruleIndexBox}>
          <TerminalText glow tone={rule.tone} variant="label">
            {rule.index}
          </TerminalText>
        </View>
        <View style={styles.ruleCopy}>
          <View style={styles.ruleTitleRow}>
            <TerminalText glow style={styles.ruleTitle} tone={rule.tone} variant="label">
              {rule.title}
            </TerminalText>
            <TerminalText glow tone={rule.tone} variant="button">
              {expanded ? '-' : '+'}
            </TerminalText>
          </View>
          {expanded ? (
            <TerminalText style={styles.ruleBody} tone="muted" uppercase={false} variant="body">
              {rule.body}
            </TerminalText>
          ) : null}
        </View>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceModal
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
    borderBottomColor: colors.divider
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
    backgroundColor: colors.surfaceOverlay
  },
  ruleCopy: {
    flex: 1
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  ruleTitle: {
    flex: 1,
    fontFamily: fontFamilies.display
  },
  ruleBody: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  rulePressed: {
    ...interactionStates.pressed
  },
  rulePressable: {
    ...interactionStates.webFocus
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
    fontFamily: fontFamilies.body
  }
});
