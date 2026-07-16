import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

const loopSteps = [
  ['COMMIT', 'Choose 1-7 verified workout days per week.'],
  ['VERIFY', 'Use a heart-rate device or partner-gym QR.'],
  ['BUILD ODDS', 'Earn prize draw entries through consistency.'],
  ['CLAIM REWARD', 'If you win, claim the physical prize or coupon code in My Rewards.']
] as const;

export default function HowItWorksScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { campaign } = useSponsorCampaign();
  const { weeklyGoal } = useWorkoutProgress();
  const [showBonusDetails, setShowBonusDetails] = useState(
    from === 'profile' || from === 'commitment'
  );
  const categoryMultipliers = [
    campaign.economics.categoryPodiumMultipliers[1],
    campaign.economics.categoryPodiumMultipliers[2],
    campaign.economics.categoryPodiumMultipliers[3]
  ] as const;
  const returnLabel =
    from === 'profile'
      ? 'BACK TO PROFILE ->'
      : from === 'commitment'
        ? 'BACK TO COMMITMENT ->'
        : 'DONE';

  function returnToSource() {
    if (from === 'profile') {
      router.replace('/profile');
      return;
    }
    if (from === 'commitment') {
      router.replace('/commitment');
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
          step="HOW SCORING WORKS"
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          THE LOOP IS SIMPLE
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Choose a weekly goal, verify your workout days and hit the goal before the
          week closes. Miss the goal and that week earns zero entries.
        </TerminalText>

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
              </View>
            </HUDBorderBox>
          ))}
        </View>

        <HUDBorderBox style={styles.progressiveNote} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            BONUSES ARRIVE WHEN THEY MATTER
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            Your Weekly Challenge appears when each scoring week starts. Category,
            Bonus Day and Perfect Month results are introduced as they become active.
          </TerminalText>
          <CyberButtonPrimary
            label={showBonusDetails ? 'HIDE BONUS DETAILS' : 'VIEW BONUS DETAILS ->'}
            onPress={() => setShowBonusDetails((visible) => !visible)}
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.rewardNote} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            BRAND REWARDS // NO PAYMENT SETUP
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            If you win, GoGymGo will add the exact physical prize or coupon code to
            My Rewards. Claim instructions are provided by the sponsoring brand, and
            no bank account is connected to GoGymGo.
          </TerminalText>
        </HUDBorderBox>

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
            02 // TOP THREE CATEGORY FINISHERS
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            Finishing first, second or third in your commitment category multiplies
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
            {`When the month has days 29-31, each verified Bonus Day adds your selected ${weeklyGoal}-entry weekly goal value to the category-adjusted subtotal.`}
          </TerminalText>
          <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
            04 // PERFECT MONTH // FINAL 10X
          </TerminalText>
          <TerminalText style={styles.explanation} tone="muted" uppercase={false} variant="body">
            Hit your weekly goal in all four scoring weeks to earn the Perfect Month.
            Its final 10X multiplies the combined Weekly Challenge subtotal, category-finish
            bonus and any Bonus Day entries.
          </TerminalText>
          <View style={styles.exampleBlock}>
            <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
              EXAMPLE // 4-DAY GOAL
            </TerminalText>
            <TerminalText style={styles.exampleIntro} tone="muted" uppercase={false} variant="body">
              You hit four verified workout days in all four weeks, you and your Weekly
              Challenge partner both hit each week, and you finish first in your category.
            </TerminalText>
            <TerminalText style={styles.exampleStep} tone="text" uppercase={false} variant="body">
              Base month: 4 days x 4 weeks = 16
            </TerminalText>
            <TerminalText style={styles.exampleStep} tone="text" uppercase={false} variant="body">
              Weekly Challenge bonuses: 16 x 2 = 32
            </TerminalText>
            <TerminalText style={styles.exampleStep} tone="text" uppercase={false} variant="body">
              First in category: 32 x 3 = 96
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
          <CompactTextButton label="VIEW FULL RULES" onPress={() => router.push('/commitment-rules')} />
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
  bonusPanel: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    padding: spacing.lg
  },
  progressiveNote: {
    marginTop: spacing.lg,
    gap: spacing.md,
    padding: spacing.lg
  },
  rewardNote: {
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
