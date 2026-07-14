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
import { OnboardingHeader } from '@/components/onboarding';
import { SponsorRail } from '@/components/sponsor';
import { isDemoVerificationEnabled } from '@/config/demoVerification';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { getCompetitionRegionDateKey } from '@/domain/competition';
import { goBackOrReplace } from '@/navigation/goBack';
import { formatCampaignDate, useSponsorCampaign } from '@/state/sponsorCampaign';
import { useDemoEnrollment } from '@/state/demoEnrollment';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function EntryConfirmedScreen() {
  const router = useRouter();
  const { enrollment } = useSponsorCampaign();
  const { demoEnrollment } = useDemoEnrollment();
  const {
    competition,
    competitionEntryStartDateKey,
    competitionTimeZone,
    lateRegistration,
    signupEntries,
    weeklyGoal
  } = useWorkoutProgress();
  const currentDateKey = getCompetitionRegionDateKey(
    new Date(),
    competitionTimeZone
  );
  const canChangeGoal = currentDateKey < competitionEntryStartDateKey;
  const competitionActive = competition.phase !== 'before-month';
  const competitionStartLabel = formatCampaignDate(
    competitionEntryStartDateKey
  ).toUpperCase();

  return (
    <ScreenContainer>
      <SponsorRail compact />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="COMPLETE"
          onBack={() => (
            canChangeGoal
              ? goBackOrReplace(router, '/commitment')
              : router.replace('/home')
          )}
          progress={100}
          step="REGISTRATION"
        />

        <HUDBorderBox glow style={styles.confirmationMark} tone="green">
          <TerminalText glow tone="green" variant="label">
            {isDemoVerificationEnabled
              ? demoEnrollment
                ? 'DEMO ENROLLED'
                : 'NOT ENROLLED'
              : 'CONFIRMED'}
          </TerminalText>
        </HUDBorderBox>

        <TerminalText glow style={styles.title} tone="green" variant="title">
          {isDemoVerificationEnabled
            ? demoEnrollment
              ? 'NON-CASH DEMO ACTIVE'
              : 'DEMO ENROLLMENT MISSING'
            : "YOU'RE REGISTERED"}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          {isDemoVerificationEnabled
            ? demoEnrollment
              ? 'Your zero-value BC demo enrollment is recorded. No prize entry, winner eligibility, payout or Hyperwallet account was created.'
              : 'A demo enrollment was not confirmed. Return to your weekly goal and try again.'
            : canChangeGoal
            ? `Your Weekly Goal is set for this month. You can change it before scoring begins on ${competitionStartLabel}.`
            : 'Your Weekly Goal is locked because competition scoring has started.'}
        </TerminalText>

        <HUDBorderBox style={styles.summaryPanel} tone="cyan">
          <SummaryRow
            label="WEEKLY GOAL"
            value={`${weeklyGoal} ${weeklyGoal === 1 ? 'DAY' : 'DAYS'}`}
          />
          <SummaryRow
            label="SCORING START"
            value={formatCampaignDate(competitionEntryStartDateKey).toUpperCase()}
          />
          <SummaryRow
            label={isDemoVerificationEnabled ? 'DEMO ENROLLMENT' : 'FREE PRIZE DRAW ENTRY'}
            value={isDemoVerificationEnabled
              ? demoEnrollment
                ? 'ACTIVE // ZERO VALUE'
                : 'NOT CREATED'
              : `${signupEntries}`}
            tone="pink"
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.activationNote} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            {isDemoVerificationEnabled ? 'BC DEMO STATUS' : 'PRIZE DRAW STATUS'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {isDemoVerificationEnabled
              ? demoEnrollment
                ? 'This enrollment is for product testing only. Competition workout scoring, entries, draws, winners and payouts stay disabled.'
                : 'No demo enrollment exists for this account.'
              : competitionActive && lateRegistration
              ? `Your free Prize Draw Entry is secured. Scoring starts on your registration day with your ${weeklyGoal}-day goal.`
              : competitionActive
                ? 'Your free Prize Draw Entry is secured. Competition scoring is active, and verified workouts now count toward your Weekly Goal.'
              : `Your free Prize Draw Entry is secured. The region needs ${enrollment.minimumEntrants} registered players to launch. If it does not launch, your entry carries forward.`}
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.payoutNote} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            {isDemoVerificationEnabled ? 'PAYOUTS DISABLED' : 'IF YOU WIN MONEY'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {isDemoVerificationEnabled
              ? 'Hyperwallet is not connected in this demo and no payout can be initiated.'
              : 'GoGymGo will notify you and ask you to create a Hyperwallet payout account. You will connect your bank securely with Hyperwallet only after a prize is confirmed.'}
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.actions}>
          {canChangeGoal && !isDemoVerificationEnabled ? (
            <CyberButtonOutline
              label="CHANGE WEEKLY GOAL"
              onPress={() => router.replace('/commitment')}
            />
          ) : null}
          <CyberButtonPrimary
            label="ENTER GOGYMGO ->"
            onPress={() => router.replace('/home')}
          />
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function SummaryRow({
  label,
  tone = 'cyan',
  value
}: {
  label: string;
  tone?: 'cyan' | 'pink';
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <TerminalText style={styles.summaryLabelText} tone="muted" variant="body">
        {label}
      </TerminalText>
      <TerminalText glow style={styles.summaryValueText} tone={tone} variant="body">
        {value}
      </TerminalText>
    </View>
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
  confirmationMark: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg
  },
  title: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  summaryPanel: {
    marginTop: spacing.xl,
    gap: spacing.md,
    padding: spacing.lg
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  summaryLabelText: {
    fontFamily: fontFamilies.terminal
  },
  summaryValueText: {
    fontFamily: fontFamilies.terminal
  },
  activationNote: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.lg
  },
  payoutNote: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.lg
  },
  actions: {
    marginTop: spacing.xl
  }
});
