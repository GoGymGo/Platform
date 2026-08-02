import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { resolveCategoryPodiumMultipliers } from '@/config/competition';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { useWorkoutProgress } from '@/state/workoutProgress';

const loopSteps = [
  ['COMMIT', 'Choose 1-7 verified workout days per week.'],
  ['VERIFY', 'Scan the approved gym QR on entry and again after 30 minutes.'],
  [
    'BUILD ODDS',
    'Earn prize draw entries through consistency, teamwork and competition'
  ],
  [
    'CLAIM REWARD',
    'If you win, your physical prize or coupon code appears in My Rewards with brand claim instructions. No bank account is needed.'
  ]
] as const;

export default function HowItWorksScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { currentCompetition } = useSessionRegistrationAccess();
  const { weeklyGoal } = useWorkoutProgress();
  const [showBonusDetails, setShowBonusDetails] = useState(
    from === 'profile' || from === 'commitment'
  );
  const podiumMultipliers = resolveCategoryPodiumMultipliers(
    currentCompetition?.rules
  );
  const categoryMultipliers = [
    podiumMultipliers[1],
    podiumMultipliers[2],
    podiumMultipliers[3]
  ] as const;
  const returnLabel =
    from === 'profile'
      ? 'Back to Profile ->'
      : from === 'commitment'
        ? 'Back to Weekly Goal ->'
        : from === 'leaderboard'
          ? 'Back to Competition ->'
          : from === 'challenge'
            ? 'Back to Weekly Challenge ->'
            : from === 'home'
              ? 'Back to Home ->'
              : 'Done';

  function returnToSource() {
    if (from === 'profile') {
      router.replace('/profile');
      return;
    }
    if (from === 'commitment') {
      router.replace('/commitment');
      return;
    }
    if (from === 'leaderboard') {
      router.replace('/leaderboard');
      return;
    }
    if (from === 'challenge') {
      router.replace('/squad');
      return;
    }
    if (from === 'home') {
      router.replace('/home');
      return;
    }
    goBackOrReplace(router, '/commitment');
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="REFERENCE"
          onBack={returnToSource}
          step="COMPETITION GUIDE"
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          HOW THE COMPETITION WORKS
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          A quick reference for competition scoring, winning odds and brand rewards.
        </TerminalText>

        <HUDBorderBox style={styles.flowSummary} tone="cyan">
          <TerminalText tone="cyan" uppercase={false} variant="caption">
            Choose goal → Verify workouts → Earn entries → Improve odds → Claim rewards
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.loopList}>
          {loopSteps.map(([title, detail]) => (
            <HUDBorderBox key={title} style={styles.loopRow} tone="muted">
              <View style={styles.loopCopy}>
                <TerminalText style={styles.loopTitle} tone="text" variant="body">
                  {title}
                </TerminalText>
                <TerminalText style={styles.loopDetail} tone="muted" uppercase={false} variant="body">
                  {detail}
                </TerminalText>
                {title === 'BUILD ODDS' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showBonusDetails }}
                    hitSlop={8}
                    onPress={() => setShowBonusDetails((visible) => !visible)}
                    style={({ pressed }) => [
                      styles.bonusDetailsButton,
                      pressed ? styles.bonusDetailsButtonPressed : null
                    ]}
                  >
                    <TerminalText
                      style={styles.bonusDetailsButtonLabel}
                      tone="amber"
                      uppercase={false}
                      variant="label"
                    >
                      {showBonusDetails ? 'Hide bonus details' : 'View bonus details'}
                    </TerminalText>
                  </Pressable>
                ) : null}
              </View>
            </HUDBorderBox>
          ))}
        </View>

        {showBonusDetails ? <HUDBorderBox glow style={styles.bonusPanel} tone="cyan">
          <TerminalText glow style={styles.panelHeading} tone="cyan" variant="label">
            SCORING ORDER
          </TerminalText>
          <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
            01 // WEEKLY CHALLENGE BONUSES
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            You and your Weekly Challenge partner both hit the goal: 2X each. If they miss and
            you complete one extra verified workout, you earn 3X. When your goal uses
            every available day, 3X is automatic if they miss. Add the four settled
            weekly results.
          </TerminalText>
          <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
            02 // TOP THREE GOAL-GROUP FINISHERS
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            Finishing first, second or third in your Weekly Goal group multiplies
            the subtotal from your four Weekly Challenge results.
          </TerminalText>
          {categoryMultipliers.map((multiplier, index) => (
            <TerminalText
              key={multiplier}
              style={styles.calculationRow}
              tone="text"
              uppercase={false}
              variant="body"
            >
              {`${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'} place: ${multiplier}X your Weekly Challenge subtotal`}
            </TerminalText>
          ))}
          <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
              03 // BONUS DAYS 29-31
          </TerminalText>
          <TerminalText
            style={styles.supportingNote}
            tone="muted"
            uppercase={false}
            variant="body"
          >
            {`When the month has days 29-31, each verified Bonus Day adds ${weeklyGoal} Prize Draw ${weeklyGoal === 1 ? 'Entry' : 'Entries'}.`}
          </TerminalText>
          <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
            04 // PERFECT MONTH // FINAL 10X
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            Hit your weekly goal in all four scoring weeks to earn the Perfect Month.
            Its final 10X multiplies the combined Weekly Challenge subtotal, goal-group
            bonus and any Bonus Day entries.
          </TerminalText>
          <View style={styles.exampleBlock}>
            <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
              EXAMPLE // 4-DAY GOAL
            </TerminalText>
            <TerminalText style={styles.exampleIntro} tone="muted" uppercase={false} variant="body">
              You hit four verified workout days in all four weeks, you and your Weekly
              Challenge partner both hit each week, and you finish first in your goal group.
            </TerminalText>
            <TerminalText style={styles.exampleStep} tone="text" uppercase={false} variant="body">
              Base month: 4 days x 4 weeks = 16
            </TerminalText>
            <TerminalText style={styles.exampleStep} tone="text" uppercase={false} variant="body">
              Weekly Challenge bonuses: 16 x 2 = 32
            </TerminalText>
            <TerminalText style={styles.exampleStep} tone="text" uppercase={false} variant="body">
              First in goal group: 32 x 3 = 96
            </TerminalText>
            <TerminalText style={styles.exampleResult} tone="cyan" uppercase={false} variant="body">
              Perfect month: 96 x 10 = 960 entries
            </TerminalText>
            <TerminalText style={styles.exampleNote} tone="dim" uppercase={false} variant="body">
              No Bonus Days are included in this example.
            </TerminalText>
          </View>
        </HUDBorderBox> : null}

        <View style={styles.actions}>
          <CompactTextButton label="View full rules" onPress={() => router.push('/commitment-rules')} />
          <CyberButtonPrimary label={returnLabel} onPress={returnToSource} />
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control,
    lineHeight: 23,
    paddingHorizontal: spacing.sm,
    textAlign: 'center'
  },
  loopList: {
    marginTop: spacing.xl,
    gap: spacing.sm
  },
  flowSummary: {
    marginTop: spacing.lg,
    padding: spacing.md
  },
  loopRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg
  },
  loopCopy: {
    flex: 1
  },
  loopTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  loopDetail: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  bonusDetailsButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderWarningGlow,
    borderRadius: 8,
    backgroundColor: colors.surfaceWarningActive
  },
  bonusDetailsButtonPressed: {
    opacity: 0.72
  },
  bonusDetailsButtonLabel: {
    color: colors.amber,
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.label,
    lineHeight: 16
  },
  bonusPanel: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    padding: spacing.lg
  },
  panelHeading: {
    fontSize: fontSizes.control,
    lineHeight: 20
  },
  sectionHeading: {
    fontSize: fontSizes.button,
    lineHeight: 18
  },
  explanation: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
    lineHeight: 21
  },
  calculationRow: {
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  supportingNote: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  exampleBlock: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSoft,
    gap: spacing.xs
  },
  exampleIntro: {
    marginBottom: spacing.xs,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  exampleStep: {
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  exampleResult: {
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.control,
    lineHeight: 22
  },
  exampleNote: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.label,
    lineHeight: 17
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm
  }
});
