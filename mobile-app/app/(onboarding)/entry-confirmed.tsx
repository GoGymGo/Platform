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
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useCurrentEnrollment } from '@/data/accountReadinessHooks';
import { goBackOrReplace } from '@/navigation/goBack';
import { formatCampaignDate, useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function EntryConfirmedScreen() {
  const router = useRouter();
  const { enrollment } = useSponsorCampaign();
  const serverEnrollment = useCurrentEnrollment();
  const {
    competition,
    competitionEntryStartDateKey,
    lateRegistration,
    signupEntries,
    weeklyGoal
  } = useWorkoutProgress();
  const confirmedEnrollment = serverEnrollment.data?.status === 'active'
    ? serverEnrollment.data
    : null;
  const confirmedGoal = confirmedEnrollment?.goalDays ?? weeklyGoal;
  const competitionActive = competition.phase !== 'before-month';
  const competitionStartLabel = formatCampaignDate(
    competitionEntryStartDateKey
  ).toUpperCase();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="COMPLETE"
          onBack={() => goBackOrReplace(
            router,
            confirmedEnrollment ? '/home' : '/commitment'
          )}
          progress={100}
          step="REGISTRATION"
        />

        <HUDBorderBox
          glow
          style={styles.confirmationMark}
          tone={confirmedEnrollment ? 'green' : 'amber'}
        >
          <TerminalText glow tone={confirmedEnrollment ? 'green' : 'amber'} variant="label">
            {serverEnrollment.isLoading
              ? 'CHECKING'
              : confirmedEnrollment
                ? 'CONFIRMED'
                : 'NOT CONFIRMED'}
          </TerminalText>
        </HUDBorderBox>

        <TerminalText
          glow
          style={styles.title}
          tone={confirmedEnrollment ? 'green' : 'amber'}
          variant="title"
        >
          {confirmedEnrollment ? "YOU'RE REGISTERED" : 'REGISTRATION INCOMPLETE'}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          {confirmedEnrollment
            ? `Your ${confirmedGoal}-day Weekly Goal is registered and locked for this competition. Scoring begins on ${competitionStartLabel}.`
            : 'Return to registration to finish the legal, region, and competition checks.'}
        </TerminalText>

        {confirmedEnrollment ? <HUDBorderBox style={styles.summaryPanel} tone="cyan">
          <SummaryRow
            label="WEEKLY GOAL"
            value={`${confirmedGoal} ${confirmedGoal === 1 ? 'DAY' : 'DAYS'}`}
          />
          <SummaryRow
            label="SCORING START"
            value={formatCampaignDate(competitionEntryStartDateKey).toUpperCase()}
          />
          <SummaryRow label="FREE PRIZE DRAW ENTRY" value={`${signupEntries}`} tone="pink" />
        </HUDBorderBox> : null}

        {confirmedEnrollment ? <HUDBorderBox style={styles.activationNote} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            PRIZE DRAW STATUS
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {competitionActive && lateRegistration
              ? `Your free Prize Draw Entry is secured. Scoring starts on your registration day with your ${confirmedGoal}-day goal.`
              : competitionActive
                ? 'Your free Prize Draw Entry is secured. Competition scoring is active, and verified workouts now count toward your Weekly Goal.'
              : `Your free Prize Draw Entry is secured. The region needs ${enrollment.minimumEntrants} registered players to launch. If it does not launch, your entry carries forward.`}
          </TerminalText>
        </HUDBorderBox> : null}

        {confirmedEnrollment ? <HUDBorderBox style={styles.rewardNote} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            IF YOU WIN A REWARD
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            GoGymGo will notify you and place the physical prize or coupon code in
            My Rewards. No payment account or banking setup is required.
          </TerminalText>
        </HUDBorderBox> : null}

        <View style={styles.actions}>
          {confirmedEnrollment ? (
            <CyberButtonPrimary
              label="ENTER GOGYMGO ->"
              onPress={() => router.replace('/home')}
            />
          ) : (
            <CyberButtonOutline
              label="RETURN TO REGISTRATION"
              onPress={() => router.replace('/commitment')}
            />
          )}
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
  rewardNote: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.lg
  },
  actions: {
    marginTop: spacing.xl
  }
});
