import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import {
  BrandVideoAdPlaceholder,
  SponsorRail as SponsorBanner
} from '@/components/sponsor';
import { ProfileAvatar } from '@/components/profileAvatar';
import { StreakRewards, UserAlias } from '@/components/streakRewards';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import {
  useCompetitionEnrollmentCount,
  useCreatorWorkouts,
  useMyRewardAwards,
  useMyStreaks
} from '@/data/appDataHooks';
import { getPublicInitials } from '@/domain/profile';
import { useProfile } from '@/state/profile';
import { useAuth } from '@/state/auth';
import {
  getPreferenceOwnerId,
  getVerificationPreference,
  type VerificationPreference
} from '@/state/onboardingPreferences';
import { formatCampaignDate, useSponsorCampaign } from '@/state/sponsorCampaign';
import { useWorkoutProgress } from '@/state/workoutProgress';

type HomeStat = {
  label: string;
  tone: 'cyan' | 'pink';
  value: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const preferenceOwnerId = getPreferenceOwnerId(user?.uid);
  const [showMore, setShowMore] = useState(false);
  const [verificationPreference, setVerificationPreference] = useState<VerificationPreference>({
    method: 'heartRate',
    sourceKey: 'heartRateDevice',
    sourceLabel: 'HEART-RATE DEVICE'
  });
  const { profileImageUri, publicName } = useProfile();
  const { enrollment } = useSponsorCampaign();
  const publicInitials = getPublicInitials(publicName);
  const {
    activeSession,
    competition,
    competitionRegion,
    currentWeekIndex,
    currentWeekVerified,
    prizeDrawEligible,
    totalEntries,
    verifiedSessionCount,
    weeklyGoal
  } = useWorkoutProgress();
  const currentPeriod = competition.currentPeriod;
  const completedSessions = Math.min(currentWeekVerified, weeklyGoal);
  const remainingSessions = Math.max(weeklyGoal - completedSessions, 0);
  const isBonusDayPhase = competition.phase === 'bonus-days';
  const competitionNotStarted = competition.phase === 'before-month';
  const competitionStartLabel = formatCampaignDate(`${competition.competitionMonthKey}-01`);
  const [competitionYear, competitionMonth] = competition.competitionMonthKey.split('-').map(Number);
  const competitionStartMonth = new Intl.DateTimeFormat('en-CA', { month: 'long' }).format(
    new Date(competitionYear, competitionMonth - 1, 1, 12)
  );
  const {
    data: currentEntrantsData,
    isPending: currentEntrantsPending
  } = useCompetitionEnrollmentCount(competitionRegion, competition.competitionMonthKey);
  const { data: creatorWorkouts = [] } = useCreatorWorkouts();
  const { data: rewardAwards = [] } = useMyRewardAwards();
  const { data: streakSummary, isPending: streaksPending } = useMyStreaks();
  const currentEntrants = currentEntrantsData ?? null;
  const unclaimedReward = rewardAwards.find((award) => award.status === 'awarded');
  const featuredCreatorWorkout =
    creatorWorkouts.find((workout) => workout.joined) ?? null;
  const launchConfirmed = currentEntrants !== null && currentEntrants >= enrollment.minimumEntrants;
  const entrantsNeeded = currentEntrants === null
    ? null
    : Math.max(0, enrollment.minimumEntrants - currentEntrants);
  const liveMultiplier = currentPeriod?.liveMultiplier ?? 0;
  const stats: readonly HomeStat[] = [
    {
      value: String(totalEntries),
      label: 'PRIZE DRAW ENTRIES',
      tone: 'pink'
    },
    {
      value: `${completedSessions}/${weeklyGoal}`,
      label: competitionNotStarted ? 'PRE-COMP VERIFIED' : 'YOUR DAYS',
      tone: 'cyan'
    },
    {
      value: currentPeriod
        ? `${Math.min(currentPeriod.opponentVerifiedCount, weeklyGoal)}/${weeklyGoal}`
        : `--/${weeklyGoal}`,
      label: currentPeriod ? 'PARTNER DAYS' : 'CHALLENGE PENDING',
      tone: 'cyan'
    }
  ];

  useEffect(() => {
    if (!preferenceOwnerId) {
      return;
    }

    void getVerificationPreference(preferenceOwnerId).then(setVerificationPreference);
  }, [preferenceOwnerId]);

  const workoutStartRoute: Href = verificationPreference.method === 'partnerGymQr'
    ? '/qr-scanner'
    : '/workout/check-in';

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <TerminalText glow tone="cyan" variant="label">
              ACCOUNT READY // {competitionRegion}
            </TerminalText>
            <UserAlias
              alias={publicName}
              glow
              streaks={streakSummary?.streaks}
              textStyle={styles.username}
              tone="cyan"
              variant="title"
            />
          </View>
          <ProfileAvatar imageUri={profileImageUri} initials={publicInitials} showStatus size={46} />
        </View>

        <HUDBorderBox glow style={styles.commitmentCard} tone="cyan">
          <View style={styles.commitmentHeader}>
            <View style={styles.commitmentTitleBlock}>
              <TerminalText glow tone="cyan" variant="label">
                {isBonusDayPhase
                  ? 'BONUS DAYS 29-31'
                  : competitionNotStarted
                    ? 'UPCOMING COMPETITION'
                    : `WEEK ${currentWeekIndex ?? 1} // ${completedSessions > 0 ? 'IN MOTION' : 'READY'}`}
              </TerminalText>
              <TerminalText style={styles.commitmentTitle} tone="text" uppercase variant="title">
                {isBonusDayPhase
                  ? `ADD ${weeklyGoal} ${weeklyGoal === 1 ? 'ENTRY' : 'ENTRIES'} PER DAY`
                  : competitionNotStarted
                    ? 'YOUR WEEKLY GOAL IS SET'
                    : verifiedSessionCount > 0
                      ? 'KEEP BUILDING YOUR WEEK'
                      : 'START YOUR FIRST SESSION'}
              </TerminalText>
              <TerminalText style={styles.commitmentCopy} tone="muted" uppercase={false} variant="body">
                {isBonusDayPhase
                  ? `Verify one workout on each remaining day to add ${weeklyGoal} prize draw ${weeklyGoal === 1 ? 'entry' : 'entries'} per day.`
                  : competitionNotStarted
                    ? 'Check in and maintain an elevated heart rate for 30 minutes to verify your workout.'
                    : remainingSessions > 0
                      ? `Complete ${remainingSessions} more verified workout ${remainingSessions === 1 ? 'day' : 'days'} to hit this week's goal. Only one workout per calendar day counts.`
                      : 'Weekly goal hit. Check your Weekly Challenge to see whether a 2x or 3x bonus is active.'}
              </TerminalText>
              {competitionNotStarted ? (
                <TerminalText glow style={styles.scoringStartWarning} tone="amber" variant="body">
                  SCORING STARTS {competitionStartMonth.toUpperCase()} 1ST 12:00AM.
                </TerminalText>
              ) : null}
            </View>
            <View style={styles.multiplierBlock}>
              <TerminalText glow style={styles.multiplier} tone="cyan" variant="value">
                {competitionNotStarted ? `${weeklyGoal}` : liveMultiplier === 0 ? '1X' : `${liveMultiplier}X`}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                {competitionNotStarted
                  ? 'DAY GOAL'
                  : liveMultiplier === 3
                    ? 'ARMED'
                    : liveMultiplier === 2
                      ? 'PARTNER'
                      : 'NO BONUS'}
              </TerminalText>
            </View>
          </View>

          <View style={styles.weekDots}>
            {Array.from({ length: weeklyGoal }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.weekDot,
                  index < completedSessions ? styles.weekDotDone : styles.weekDotOpen
                ]}
              />
            ))}
          </View>

          <CyberButtonPrimary
            label={activeSession ? 'RETURN TO ACTIVE SESSION ->' : 'START VERIFIED WORKOUT ->'}
            onPress={() => router.push(activeSession ? '/workout/active' : workoutStartRoute)}
          />
          {!activeSession ? (
            <TerminalText style={styles.defaultMethod} tone="muted" uppercase={false} variant="caption">
              Default check-in: {verificationPreference.sourceLabel}. Change it from Session or Profile.
            </TerminalText>
          ) : null}

          {competitionNotStarted ? (
            <View style={styles.launchStatus}>
              <View style={styles.launchHeader}>
                <TerminalText tone="dim" variant="micro">
                  REGIONAL LAUNCH
                </TerminalText>
                <TerminalText
                  glow={launchConfirmed}
                  tone={launchConfirmed ? 'green' : currentEntrants === null ? 'dim' : 'amber'}
                  variant="label"
                >
                  {currentEntrantsPending
                    ? 'CHECKING REGISTRATION COUNT'
                    : currentEntrants === null
                      ? 'TOTAL NOT CONNECTED'
                    : `${currentEntrants.toLocaleString()} / ${enrollment.minimumEntrants.toLocaleString()} REGISTERED`}
                </TerminalText>
              </View>
              <TerminalText tone={launchConfirmed ? 'green' : 'muted'} uppercase={false} variant="caption">
                {launchConfirmed
                  ? 'Competition launch confirmed.'
                  : entrantsNeeded === null
                    ? 'The live registration total will appear when regional enrollment sync is available.'
                    : `${entrantsNeeded} more ${entrantsNeeded === 1 ? 'player is' : 'players are'} needed to launch.`}
              </TerminalText>
            </View>
          ) : null}
        </HUDBorderBox>

        {unclaimedReward ? (
          <Pressable
            accessibilityHint="Open My Rewards to claim this award"
            accessibilityRole="button"
            onPress={() => router.push('/rewards/awards')}
            style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
          >
            <HUDBorderBox glow style={styles.rewardAlert} tone="pink">
              <View style={styles.rewardAlertCopy}>
                <TerminalText glow tone="pink" variant="label">
                  REWARD READY // {unclaimedReward.title}
                </TerminalText>
                <TerminalText tone="text" uppercase={false} variant="body">
                  Claim it in My Rewards. No payment setup is required.
                </TerminalText>
              </View>
              <TerminalText glow tone="pink" variant="button">
                -&gt;
              </TerminalText>
            </HUDBorderBox>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/calendar' as Href)}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox style={styles.calendarCard} tone="cyan">
            <View style={styles.calendarCopy}>
              <TerminalText glow tone="cyan" variant="micro">
                WORKOUT CALENDAR
              </TerminalText>
              <TerminalText style={styles.calendarTitle} tone="text" uppercase variant="body">
                VIEW CHECKED DAYS AND PERSONAL GYM LOGS
              </TerminalText>
            </View>
            <TerminalText tone="cyan" variant="button">
              -&gt;
            </TerminalText>
          </HUDBorderBox>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/squad')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox style={styles.pactCard} tone="cyan">
            <View style={styles.pactAvatars}>
              <View style={styles.pactAvatarYou}>
                <TerminalText style={styles.pactAvatarTextDark} tone="dim" variant="button">
                  {publicInitials}
                </TerminalText>
              </View>
              <View style={styles.pactAvatarMatch}>
                <TerminalText tone="muted" variant="button">
                  {getPublicInitials(currentPeriod?.opponentAlias ?? 'PARTNER')}
                </TerminalText>
              </View>
            </View>
            <View style={styles.pactCopy}>
              <TerminalText glow tone="cyan" variant="micro">
                WEEKLY CHALLENGE
              </TerminalText>
              {isBonusDayPhase || competitionNotStarted || !currentPeriod ? (
                <TerminalText style={styles.pactTitle} tone="text" uppercase variant="body">
                  {isBonusDayPhase
                    ? `BONUS DAYS 29-31 // +${weeklyGoal} ${weeklyGoal === 1 ? 'ENTRY' : 'ENTRIES'} EACH`
                    : competitionNotStarted
                      ? `CHALLENGES OPEN ${competitionStartLabel.toUpperCase()}`
                      : 'PAIRING IN PROGRESS'}
                </TerminalText>
              ) : (
                <View style={styles.pactOpponent}>
                  <UserAlias
                    alias={currentPeriod.opponentAlias}
                    streaks={currentPeriod.opponentStreaks}
                    textStyle={styles.pactTitle}
                    uppercase
                  />
                  <TerminalText tone="cyan" variant="micro">
                    {currentPeriod.opponentVerifiedCount}/{weeklyGoal} THIS WEEK
                  </TerminalText>
                </View>
              )}
            </View>
            <TerminalText tone="cyan" variant="button">
              -&gt;
            </TerminalText>
          </HUDBorderBox>
        </Pressable>

        <SponsorBanner compact style={styles.inlineSponsor} />

        <CyberButtonOutline
          label={showMore ? 'HIDE STATS & EXTRAS' : 'SHOW STATS & EXTRAS'}
          onPress={() => setShowMore((current) => !current)}
          style={styles.moreButton}
        />

        {showMore ? (
          <View style={styles.secondaryContent}>
            <StreakRewards
              isLoading={streaksPending}
              summary={streakSummary}
            />

            <View style={styles.statsRow}>
              {stats.map((stat) => (
                <HUDBorderBox key={stat.label} style={styles.statCard} tone="muted">
                  <TerminalText glow style={styles.statValue} tone={stat.tone} variant="value">
                    {stat.value}
                  </TerminalText>
                  <TerminalText style={styles.statLabel} tone="muted" variant="micro">
                    {stat.label}
                  </TerminalText>
                </HUDBorderBox>
              ))}
            </View>
            <TerminalText style={styles.oddsNote} tone="muted" uppercase={false} variant="body">
              {prizeDrawEligible
                ? competitionNotStarted
                  ? 'Your free prize draw entry is secured now. Verified workouts begin earning competition credit when scoring opens.'
                  : `Your free prize draw entry is secured. Verified workout days build weekly credit; each Bonus Day 29-31 adds your ${weeklyGoal}-entry goal value before a Perfect Month 10x.`
                : 'Your free prize draw entry is secured and will carry into the next eligible regional draw.'}
            </TerminalText>

            <BrandVideoAdPlaceholder
              compact
              onPress={() => router.push('/sponsor-offer')}
              placement="appOpen"
            />

            {featuredCreatorWorkout ? <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/workouts/${featuredCreatorWorkout.id}`)}
              style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
            >
              <HUDBorderBox style={styles.workoutCard} tone="cyan">
                <View style={styles.videoPreview}>
                  <View style={styles.videoBadgeRow}>
                    <View style={styles.creatorBadge}>
                      <TerminalText glow tone="cyan" variant="micro">
                        CREATOR WORKOUT
                      </TerminalText>
                    </View>
                    <View style={styles.channelBadge}>
                      <TerminalText glow tone="cyan" variant="micro">
                        OFFICIAL CHANNEL
                      </TerminalText>
                    </View>
                  </View>
                  <View style={styles.playCircle}>
                    <TerminalText glow tone="cyan" variant="micro">
                      VIEW
                    </TerminalText>
                  </View>
                </View>
                <View style={styles.workoutCopy}>
                  <TerminalText style={styles.workoutTitle} tone="text" uppercase variant="body">
                    {featuredCreatorWorkout.name}
                  </TerminalText>
                  <TerminalText tone="muted" uppercase={false} variant="body">
                    Optional follow-along workout. Session verification still happens in GoGymGo.
                  </TerminalText>
                </View>
              </HUDBorderBox>
            </Pressable> : null}
          </View>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md
  },
  username: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  pressableCard: {
    width: '100%'
  },
  videoAd: {
    marginBottom: spacing.lg,
  },
  commitmentCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  defaultMethod: {
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  moreButton: {
    marginTop: spacing.sm
  },
  secondaryContent: {
    gap: spacing.lg,
    marginTop: spacing.lg
  },
  streakRewards: {
    marginBottom: spacing.lg
  },
  rewardAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  rewardAlertCopy: {
    flex: 1,
    gap: spacing.xs
  },
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  commitmentTitleBlock: {
    flex: 1
  },
  commitmentTitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 25
  },
  commitmentCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body
  },
  launchStatus: {
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.whiteAlpha08
  },
  launchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  scoringStartWarning: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  multiplierBlock: {
    alignItems: 'flex-end'
  },
  multiplier: {
    fontFamily: fontFamilies.display
  },
  weekDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md
  },
  weekDot: {
    flex: 1,
    height: 8,
    borderRadius: 4
  },
  weekDotDone: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  weekDotOpen: {
    backgroundColor: colors.whiteAlpha08
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.sm
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: spacing.md
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 28
  },
  statLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  oddsNote: {
    marginBottom: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  calendarCopy: {
    flex: 1
  },
  calendarTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.bodyStrong
  },
  pactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  inlineSponsor: {
    marginHorizontal: 0,
    marginTop: spacing.xs,
    marginBottom: spacing.md
  },
  pactAvatars: {
    flexDirection: 'row'
  },
  pactAvatarYou: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.cyan
  },
  pactAvatarMatch: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    backgroundColor: colors.panelSoft,
    marginLeft: -10
  },
  pactAvatarTextDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  pactCopy: {
    flex: 1
  },
  pactOpponent: {
    gap: 2
  },
  pactTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.bodyStrong
  },
  workoutCard: {
    overflow: 'hidden',
    padding: 0,
    marginBottom: spacing.md
  },
  videoPreview: {
    minHeight: 112,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.panelAlpha70
  },
  videoBadgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  creatorBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 5
  },
  channelBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 5
  },
  playCircle: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: 25,
    backgroundColor: colors.surfaceCyanProgress,
    ...cyberGlow.cyan
  },
  workoutCopy: {
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  workoutTitle: {
    marginBottom: 3,
    fontFamily: fontFamilies.display
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
