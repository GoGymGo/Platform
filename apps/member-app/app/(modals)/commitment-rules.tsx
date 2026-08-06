import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { resolveCategoryPodiumMultipliers } from '@/config/competition';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
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
    title: 'JOIN WHILE PUBLISHED',
    body: 'Once a regional competition is published, eligible players may join before it starts or at any time while it is active. Enrollment closes when the competition ends, reaches its entrant cap, or is cancelled.',
    tone: 'cyan'
  },
  {
    index: '02',
    title: 'REGIONAL MINIMUM TO LAUNCH',
    body: 'The regional competition launches only after its published minimum number of eligible players registers.',
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
    body: 'Scan the same approved gym QR on entry and exit. Both scans require live location within the gym geofence.',
    tone: 'cyan'
  },
  {
    index: '06',
    title: 'WEEKLY 2X BONUS',
    body: 'If you and your Weekly Challenge partner both hit the Weekly Goal, you both earn the 2x Weekly Challenge Bonus for that scoring week.',
    tone: 'cyan'
  },
  {
    index: '07',
    title: 'MAKE-UP 3X BONUS',
    body: 'If your Weekly Challenge partner misses, complete one extra verified workout before the scoring week closes to earn the 3x Weekly Challenge Bonus.',
    tone: 'pink'
  },
  {
    index: '08',
    title: 'NO EXTRA DAY EXCEPTION',
    body: 'A seven-day player, or a late entrant who fills every day remaining in scoring week 1, receives 3x automatically if their Weekly Challenge partner misses.',
    tone: 'amber'
  },
  {
    index: '09',
    title: 'TOP THREE GOAL-GROUP FINISHERS',
    body: 'The top three finishers in each Weekly Goal group multiply their actual four-week total after Weekly Challenge results. Bonus Days 29-31 are added next, then Perfect Month 10x is applied last.',
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
    body: 'The Perfect Month 10x is applied last to the Weekly Challenge-adjusted, goal-group-adjusted total plus all Bonus Day entries.',
    tone: 'pink'
  }
];

export default function CommitmentRulesModal() {
  const router = useRouter();
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<string>('01');
  const { currentCompetition } = useSessionRegistrationAccess();
  const { weeklyGoal } = useWorkoutProgress();
  const podiumMultipliers = resolveCategoryPodiumMultipliers(
    currentCompetition?.rules
  );
  const currentRules = commitmentRules.map((rule) =>
    rule.index === '02' && currentCompetition
      ? {
          ...rule,
          body: `At least ${currentCompetition.minimumEntrants.toLocaleString()} eligible players across the region must register before this competition can launch.`,
          title: `${currentCompetition.minimumEntrants.toLocaleString()} PLAYERS TO LAUNCH`
        }
      : rule.index === '09'
      ? {
          ...rule,
          body: `The top three finishers in each Weekly Goal group receive ${podiumMultipliers[1]}x, ${podiumMultipliers[2]}x and ${podiumMultipliers[3]}x multipliers on their actual four-week total after Weekly Challenge results. Bonus Days 29-31 are added next, then Perfect Month 10x is applied last.`
        }
      : rule.index === '10'
        ? {
            ...rule,
            body: `This competition offers only the Bonus Days that exist after day 28. Each verified Bonus Day adds ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'}, equal to your selected Weekly Goal, before the Perfect Month 10x.`
          }
        : rule
  );

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.nav}>
        <OnboardingHeader
          label="WEEKLY GOAL RULES"
          onBack={() => goBackOrReplace(router, '/commitment')}
          step="COMPETITION"
        />
      </View>

      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BrandScreenHeader
          description="Choose any published Weekly Goal. Your eligible scoring begins when enrollment is confirmed."
          eyebrow="MONTHLY COMMITMENT"
          title="LOCK YOUR MONTH CLEARLY"
        />

        <HUDBorderBox style={styles.atGlanceCard} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            RULES AT A GLANCE
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            1. Choose a goal of 1-7 verified workout days per week.
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            2. Only one verified workout per calendar day counts.
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            3. Hit all four weekly goals to earn the Perfect Month bonus.
          </TerminalText>
        </HUDBorderBox>

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

        <HUDBorderBox style={styles.summaryCard} tone="cyan">
          <TerminalText style={styles.summaryLabel} tone="muted" variant="label">
            REGIONAL LAUNCH
          </TerminalText>
          <TerminalText style={styles.summaryValue} tone="cyan" variant="title">
            {currentCompetition
              ? `${currentCompetition.minimumEntrants.toLocaleString()} PLAYERS REQUIRED`
              : 'REGIONAL MINIMUM PENDING'}
          </TerminalText>
          <TerminalText style={styles.summaryCopy} tone="muted" uppercase={false} variant="body">
            Registration remains open until the published competition ends
            {currentCompetition?.entrantCap == null
              ? '.'
              : ` or until the ${currentCompetition.entrantCap.toLocaleString()}-player cap is reached.`}
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="BACK TO WEEKLY GOAL"
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
      style={({ pressed }) => pressed ? styles.rulePressed : null}
    >
      <HUDBorderBox style={styles.ruleRow} tone={rule.tone}>
        <View style={styles.ruleIndexBox}>
          <TerminalText tone={rule.tone} variant="label">
            {rule.index}
          </TerminalText>
        </View>
        <View style={styles.ruleCopy}>
          <View style={styles.ruleTitleRow}>
            <TerminalText style={styles.ruleTitle} tone={rule.tone} variant="label">
              {rule.title}
            </TerminalText>
            <TerminalText tone={rule.tone} variant="button">
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
    backgroundColor: colors.transparent
  },
  nav: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm
  },
  content: brandScreenStyles.content,
  rulesList: {
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  atGlanceCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.lg
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
    opacity: 0.76
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
