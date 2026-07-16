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
import { ProfileAvatar } from '@/components/profileAvatar';
import { UserAlias } from '@/components/streakRewards';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { getPublicInitials } from '@/domain/profile';
import type { StreakCounts } from '@/domain/streaks';
import {
  useEligibleWeeklyChallengePartners,
  useRequestWeeklyChallengePartner,
  useRespondToWeeklyChallengeRequest,
  useWeeklyChallengeRequests
} from '@/data/appDataHooks';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { formatDateKey, useWorkoutProgress } from '@/state/workoutProgress';
import { useProfile } from '@/state/profile';

type PlayerTone = 'cyan' | 'muted';

export default function SquadScreen() {
  const router = useRouter();
  const { competitionRegion } = useCompetitionRegion();
  const { profileImageUri, publicName } = useProfile();
  const { competition, competitionEntryStartDateKey, weeklyGoal } = useWorkoutProgress();
  const activePeriod = competition.currentPeriod;
  const weeklyChallengePeriod = activePeriod?.index ?? 1;
  const eligiblePartnersQuery = useEligibleWeeklyChallengePartners(
    competition.competitionMonthKey,
    weeklyGoal,
    competitionRegion.label,
    weeklyChallengePeriod
  );
  const requestsQuery = useWeeklyChallengeRequests(
    competition.competitionMonthKey,
    weeklyGoal,
    competitionRegion.label,
    weeklyChallengePeriod
  );
  const requestPartner = useRequestWeeklyChallengePartner();
  const respondToRequest = useRespondToWeeklyChallengeRequest();
  const [showOpponentStats, setShowOpponentStats] = useState(false);
  const [weeklyChallengeFeedback, setWeeklyChallengeFeedback] = useState<string | null>(null);
  const isRemainderDayPhase =
    competition.phase === 'bonus-days' && competition.bonusDateKeys.length > 0;
  const matchInitials = activePeriod
    ? getInitials(activePeriod.opponentAlias)
    : '--';
  const bonusStatus = activePeriod
    ? getBonusStatus(activePeriod, weeklyGoal)
    : 'AVAILABLE WHEN YOUR WEEKLY CHALLENGE STARTS';
  const bonusEndDay = Number(competition.bonusDateKeys.at(-1)?.slice(-2) ?? 28);

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            {activePeriod
              ? 'YOUR WEEKLY CHALLENGE PARTNER'
              : isRemainderDayPhase
                ? 'BONUS DAYS 29-31'
                : 'WEEKLY CHALLENGE PENDING'}
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            {activePeriod
              ? `WEEK ${activePeriod.index} WEEKLY CHALLENGE`
              : isRemainderDayPhase
                ? 'BONUS DAYS. EXTRA ENTRIES.'
                : 'YOUR FIRST WEEKLY CHALLENGE STARTS SOON'}
          </TerminalText>
        </View>

        {activePeriod ? (
          <Pressable
            accessibilityHint="Shows this player's verified stats and streaks"
            accessibilityLabel={`Weekly Challenge with ${activePeriod.opponentAlias}`}
            accessibilityRole={activePeriod.availability === 'matched' ? 'button' : undefined}
            disabled={activePeriod.availability !== 'matched'}
            onPress={() => setShowOpponentStats((visible) => !visible)}
            style={({ pressed }) => [pressed ? styles.pressed : null]}
          >
          <HUDBorderBox glow style={styles.pactCard} tone="cyan">
            <View style={styles.matchupRow}>
              <PlayerBlock
                initials={getPublicInitials(publicName)}
                imageUri={profileImageUri}
                label="YOU"
                progress={`${Math.min(activePeriod.userVerifiedCount, weeklyGoal)} / ${weeklyGoal}`}
                tone="cyan"
              />
              <TerminalText style={styles.vsText} tone="dim" variant="button">
                VS
              </TerminalText>
              <PlayerBlock
                initials={matchInitials}
                label={activePeriod.opponentAlias}
                progress={`${Math.min(activePeriod.opponentVerifiedCount, weeklyGoal)} / ${weeklyGoal}`}
                streaks={activePeriod.opponentStreaks}
                tone="muted"
              />
            </View>

            <View style={styles.dailyProgress}>
              <DailyProgressRow
                dateKeys={activePeriod.period.dateKeys}
                label="YOU"
                tone="cyan"
                verifiedDateKeys={activePeriod.userVerifiedDateKeys}
              />
              <DailyProgressRow
                dateKeys={activePeriod.period.dateKeys}
                label="THEM"
                tone="muted"
                verifiedDateKeys={activePeriod.opponentVerifiedDateKeys}
              />
            </View>

            {activePeriod.availability === 'matched' ? (
              <View style={styles.statsPrompt}>
                <TerminalText glow tone="cyan" variant="micro">
                  {showOpponentStats ? 'HIDE PLAYER STATS' : 'TAP TO VIEW PLAYER STATS + STREAKS'}
                </TerminalText>
              </View>
            ) : null}

            {showOpponentStats && activePeriod.availability === 'matched' ? (
              <HUDBorderBox style={styles.playerStatsCard} tone="muted">
                <UserAlias
                  alias={activePeriod.opponentAlias}
                  streaks={activePeriod.opponentStreaks}
                  tone="text"
                  variant="label"
                />
                <TerminalText tone="dim" variant="micro">
                  PLAYER STATS
                </TerminalText>
                <View style={styles.playerStatsGrid}>
                  <PlayerStat label="CURRENT STREAK" value={`${activePeriod.opponentCurrentStreak}D`} />
                  <PlayerStat label="BEST STREAK" value={`${activePeriod.opponentBestStreak}D`} />
                  <PlayerStat label="MONTH VERIFIED" value={String(activePeriod.opponentMonthlyVerifiedDays)} />
                  <PlayerStat label="THIS WEEK" value={`${activePeriod.opponentVerifiedCount}/${weeklyGoal}`} />
                </View>
                <TerminalText tone="dim" uppercase={false} variant="caption">
                  Only public competition activity is shown. Private workout details remain private.
                </TerminalText>
              </HUDBorderBox>
            ) : null}

            <HUDBorderBox style={styles.matchNote} tone="cyan">
              <TerminalText style={styles.matchNoteText} tone="cyan" uppercase={false} variant="body">
                {getMatchNote(activePeriod, weeklyGoal)}
              </TerminalText>
            </HUDBorderBox>
          </HUDBorderBox>
          </Pressable>
        ) : isRemainderDayPhase ? (
          <HUDBorderBox glow style={styles.pactCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              DAYS 29-{bonusEndDay}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" variant="body">
              WEEKLY CHALLENGES ARE COMPLETE. EACH VERIFIED WORKOUT ON A BONUS
              CALENDAR DAY ADDS {weeklyGoal} PRIZE DRAW {weeklyGoal === 1 ? 'ENTRY' : 'ENTRIES'} BEFORE PERFECT-MONTH 10X.
            </TerminalText>
          </HUDBorderBox>
        ) : (
          <HUDBorderBox glow style={styles.pactCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              FIRST ELIGIBLE WEEK
            </TerminalText>
            <TerminalText style={styles.pendingDate} tone="text" variant="title">
              {formatDateKey(competitionEntryStartDateKey)}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" variant="body">
              YOUR FIRST WEEKLY CHALLENGE OPENS WHEN YOUR FIRST ELIGIBLE SCORING WEEK
              STARTS. CHOOSE AN ELIGIBLE FRIEND WITH THE SAME WEEKLY GOAL, OR WAIT
              FOR OPEN PAIRING. WORKOUTS BEFORE THIS DATE CAN STILL APPEAR IN YOUR
              CALENDAR, BUT THEY DO NOT COUNT TOWARD THIS COMPETITION.
            </TerminalText>
          </HUDBorderBox>
        )}

        {activePeriod ? (
          <HUDBorderBox glow style={styles.forfeitCard} tone="pink">
            <View style={styles.forfeitHeader}>
              <TerminalText glow tone="pink" variant="micro">
                BONUS
              </TerminalText>
              <TerminalText glow tone="pink" variant="label">
                MAKE-UP BONUS
              </TerminalText>
            </View>
            <TerminalText style={styles.forfeitCopy} tone="text" uppercase={false} variant="body">
              If you both hit the Weekly Goal, you each earn 2x. If your Weekly Challenge
              partner misses, one extra verified workout upgrades your week to 3x.
              The 3x upgrade is automatic when your goal already uses every available day.
            </TerminalText>
            <View style={styles.claimRow}>
              <TerminalText tone="muted" variant="micro">
                STATUS
              </TerminalText>
              <TerminalText glow style={styles.claimValue} tone="pink" variant="body">
                {bonusStatus}
              </TerminalText>
            </View>
          </HUDBorderBox>
        ) : null}

        <HUDBorderBox style={styles.partnerRequestCard} tone="pink">
          <TerminalText glow tone="pink" variant="label">
            CHOOSE YOUR WEEKLY CHALLENGE
          </TerminalText>
          <TerminalText style={styles.partnerRequestCopy} tone="muted" uppercase={false} variant="body">
            Request a friend you know for week {weeklyChallengePeriod}. They must already be in this competition with the same {weeklyGoal}-day Weekly Goal. A pairing is created only after they accept.
          </TerminalText>

          {(requestsQuery.data ?? []).filter(({ direction }) => direction === 'incoming').map((request) => (
            <HUDBorderBox key={request.id} style={styles.incomingRequest} tone="amber">
              <TerminalText tone="amber" variant="micro">INCOMING REQUEST</TerminalText>
              <UserAlias
                alias={request.partnerAlias}
                prefix="@"
                streaks={request.partnerStreaks}
              />
              <View style={styles.requestActions}>
                <CyberButtonPrimary
                  disabled={respondToRequest.isPending}
                  label="ACCEPT"
                  onPress={() => void respondToRequest.mutateAsync({ decision: 'accepted', requestId: request.id })
                    .then(() => setWeeklyChallengeFeedback(`@${request.partnerAlias} is now your Weekly Challenge partner.`))
                    .catch(() => setWeeklyChallengeFeedback('That request could not be accepted. Try again.'))}
                />
                <CyberButtonOutline
                  disabled={respondToRequest.isPending}
                  label="DECLINE"
                  onPress={() => void respondToRequest.mutateAsync({ decision: 'declined', requestId: request.id })
                    .then(() => setWeeklyChallengeFeedback('Weekly Challenge request declined.'))
                    .catch(() => setWeeklyChallengeFeedback('That request could not be declined. Try again.'))}
                />
              </View>
            </HUDBorderBox>
          ))}

          {activePeriod?.availability === 'matched' ? (
            <View style={styles.confirmedPartner}>
              <TerminalText tone="green" uppercase={false} variant="body">
                Your week {weeklyChallengePeriod} Weekly Challenge is set with
              </TerminalText>
              <UserAlias
                alias={activePeriod.opponentAlias}
                prefix="@"
                streaks={activePeriod.opponentStreaks}
                tone="green"
              />
            </View>
          ) : (eligiblePartnersQuery.data ?? []).length > 0 ? (
            <View style={styles.partnerList}>
              {(eligiblePartnersQuery.data ?? []).map((partner) => (
                <View key={partner.userId} style={styles.partnerRow}>
                  <View style={styles.partnerIdentity}>
                    <UserAlias
                      alias={partner.alias}
                      prefix="@"
                      streaks={partner.streaks}
                    />
                    <TerminalText tone="dim" variant="micro">{partner.goalDays}-DAY GOAL // ELIGIBLE</TerminalText>
                  </View>
                  <CyberButtonOutline
                    disabled={requestPartner.isPending || partner.requestStatus === 'pending'}
                    label={partner.requestStatus === 'pending' ? 'PENDING' : 'REQUEST'}
                    onPress={() => void requestPartner.mutateAsync({
                      competitionMonthKey: competition.competitionMonthKey,
                      periodIndex: weeklyChallengePeriod,
                      recipientUserId: partner.userId,
                      region: competitionRegion.label,
                      weeklyGoal
                    })
                      .then(() => setWeeklyChallengeFeedback(`Weekly Challenge request sent to @${partner.alias}.`))
                      .catch(() => setWeeklyChallengeFeedback('That Weekly Challenge request could not be sent.'))}
                    style={styles.requestButton}
                  />
                </View>
              ))}
            </View>
          ) : (
            <TerminalText tone="dim" uppercase={false} variant="body">
              No accepted friends currently meet this week&apos;s competition and commitment requirements.
            </TerminalText>
          )}

          {weeklyChallengeFeedback ? (
            <TerminalText live="polite" tone="cyan" uppercase={false} variant="caption">
              {weeklyChallengeFeedback}
            </TerminalText>
          ) : null}
        </HUDBorderBox>

        <CyberButtonOutline
          label="CHALLENGE A FRIEND ->"
          onPress={() => router.push('/squad/social')}
          style={styles.socialButton}
          tone="pink"
        />

        <CyberButtonOutline
          label="VIEW GYM COMPETITION ->"
          onPress={() => router.push('/squad/gym')}
          style={styles.gymButton}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function DailyProgressRow({
  dateKeys,
  label,
  tone,
  verifiedDateKeys
}: {
  dateKeys: readonly string[];
  label: string;
  tone: PlayerTone;
  verifiedDateKeys: readonly string[];
}) {
  const verifiedDates = new Set(verifiedDateKeys);

  return (
    <View style={styles.dailyRow}>
      <TerminalText style={styles.dailyLabel} tone={tone} variant="micro">
        {label}
      </TerminalText>
      <View style={styles.dailyCells}>
        {dateKeys.map((dateKey) => {
          const verified = verifiedDates.has(dateKey);

          return (
            <View
              accessibilityLabel={`${label}, day ${Number(dateKey.slice(-2))}, ${verified ? 'verified' : 'not verified'}`}
              key={`${label}-${dateKey}`}
              style={[
                styles.dailyCell,
                verified
                  ? tone === 'muted'
                    ? styles.dailyCellMuted
                    : styles.dailyCellCyan
                  : styles.dailyCellOpen
              ]}
            >
              <TerminalText glow={verified} tone={verified ? tone : 'dim'} variant="micro">
                {Number(dateKey.slice(-2))}
              </TerminalText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PlayerStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.playerStat}>
      <TerminalText glow tone="cyan" variant="body">{value}</TerminalText>
      <TerminalText style={styles.playerStatLabel} tone="dim" variant="micro">{label}</TerminalText>
    </View>
  );
}

function getMatchNote(
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>,
  weeklyGoal: number
) {
  if (period.availability === 'solo') {
    return `NO COMPATIBLE WEEKLY CHALLENGE PARTNER WAS AVAILABLE. HIT ${weeklyGoal} VERIFIED WORKOUT DAYS FOR THE STANDARD 1X RESULT.`;
  }

  if (period.userGoalMet && period.opponentGoalMet) {
    return `BOTH PLAYERS HIT ${weeklyGoal}. THE 2X RESULT IS SECURED WHEN THIS WEEK CLOSES.`;
  }

  if (period.userGoalMet && period.bonusWorkoutCompleted) {
    return weeklyGoal === 7
      ? 'YOUR SEVEN-DAY GOAL IS COMPLETE. 3X ACTIVATES AUTOMATICALLY IF YOUR WEEKLY CHALLENGE PARTNER MISSES.'
      : 'YOUR EXTRA VERIFIED WORKOUT IS COMPLETE. 3X IS ARMED IF YOUR WEEKLY CHALLENGE PARTNER MISSES.';
  }

  if (period.userGoalMet) {
    return `YOUR ${weeklyGoal}-DAY GOAL IS COMPLETE. ADD ONE MORE VERIFIED WORKOUT TO ARM 3X IF YOUR WEEKLY CHALLENGE PARTNER MISSES.`;
  }

  const remaining = weeklyGoal - period.userVerifiedCount;
  const deadline = formatDateKey(period.period.dateKeys.at(-1) ?? period.period.dateKeys[0]);
  const opponentProgress = Math.min(period.opponentVerifiedCount, weeklyGoal);

  return `Complete ${remaining} more verified ${remaining === 1 ? 'workout' : 'workouts'} by ${deadline}. Your Weekly Challenge partner is at ${opponentProgress}/${weeklyGoal}. ${period.opponentGoalMet ? 'Hit your goal to secure 2x with them.' : 'The 2x bonus remains available if you both hit the goal.'}`;
}

function getBonusStatus(
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>,
  weeklyGoal: number
) {
  if (period.userGoalMet && period.opponentGoalMet) {
    return '2X SECURED';
  }

  if (period.userGoalMet && period.bonusWorkoutCompleted) {
    return weeklyGoal === 7 ? '3X AUTO-ARMED' : '3X ARMED';
  }

  if (period.userGoalMet) {
    return weeklyGoal === 7 ? 'WAITING ON PARTNER' : 'EXTRA WORKOUT AVAILABLE';
  }

  return `${weeklyGoal - period.userVerifiedCount} TO GO`;
}

function getInitials(alias: string) {
  return alias
    .split(/[_\s]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PlayerBlock({
  imageUri,
  initials,
  label,
  progress,
  streaks,
  tone
}: {
  imageUri?: string | null;
  initials: string;
  label: string;
  progress: string;
  streaks?: StreakCounts;
  tone: PlayerTone;
}) {
  const isMuted = tone === 'muted';

  return (
    <View style={styles.playerBlock}>
      {imageUri ? (
        <ProfileAvatar imageUri={imageUri} initials={initials} size={50} />
      ) : (
        <View style={[styles.playerAvatar, isMuted ? styles.playerAvatarMuted : styles.playerAvatarCyan]}>
          <TerminalText style={isMuted ? styles.playerInitialsLight : styles.playerInitialsDark} tone="text" variant="button">
            {initials}
          </TerminalText>
        </View>
      )}
      <UserAlias
        alias={label}
        streaks={streaks}
        style={styles.playerAlias}
        textStyle={styles.playerLabel}
      />
      <TerminalText glow style={styles.playerProgress} tone={tone} variant="micro">
        {progress}
      </TerminalText>
    </View>
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
    marginBottom: spacing.lg
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  pactCard: {
    marginBottom: spacing.lg,
    padding: 18
  },
  pendingDate: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontFamily: fontFamilies.display
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  playerBlock: {
    flex: 1,
    alignItems: 'center'
  },
  playerAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14
  },
  playerAvatarCyan: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  playerAvatarMuted: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft,
    ...cyberGlow.muted
  },
  playerInitialsDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  playerInitialsLight: {
    color: colors.text,
    fontFamily: fontFamilies.display
  },
  playerLabel: {
    fontFamily: fontFamilies.terminal
  },
  playerAlias: {
    justifyContent: 'center',
    marginTop: spacing.sm
  },
  playerProgress: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  vsText: {
    fontFamily: fontFamilies.display
  },
  matchNote: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 14
  },
  statsPrompt: {
    alignItems: 'center',
    marginTop: spacing.md
  },
  playerStatsCard: {
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md
  },
  playerStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  playerStat: {
    width: '47%',
    gap: 2,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 6,
    backgroundColor: colors.panelAlpha45
  },
  playerStatLabel: {
    fontFamily: fontFamilies.terminal
  },
  matchNoteText: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  dailyProgress: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  dailyLabel: {
    width: 42,
    fontFamily: fontFamilies.terminal
  },
  dailyCells: {
    flex: 1,
    flexDirection: 'row',
    gap: 4
  },
  dailyCell: {
    flex: 1,
    minWidth: 0,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 6
  },
  dailyCellOpen: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelAlpha45
  },
  dailyCellCyan: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  dailyCellMuted: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceMutedGlow
  },
  forfeitCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  forfeitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  forfeitCopy: {
    fontFamily: fontFamilies.body
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 13
  },
  claimValue: {
    fontFamily: fontFamilies.display,
    textAlign: 'right'
  },
  gymButton: {
    marginTop: spacing.lg
  },
  socialButton: {
    marginTop: spacing.lg
  },
  partnerRequestCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  partnerRequestCopy: {
    fontFamily: fontFamilies.body
  },
  incomingRequest: {
    gap: spacing.sm,
    padding: spacing.md
  },
  requestActions: {
    gap: spacing.sm
  },
  partnerList: {
    gap: spacing.sm
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 6,
    backgroundColor: colors.panelAlpha45
  },
  partnerIdentity: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  confirmedPartner: {
    gap: spacing.xs
  },
  requestButton: {
    width: 112,
    minHeight: 44
  },
  pressed: {
    opacity: 0.78
  },
});
