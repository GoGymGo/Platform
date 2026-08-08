import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { FirstVisitTip, InlineHelpButton } from '@/components/clarity';
import { CompetitionHubNav } from '@/components/competitionHubNav';
import { BrandScreenHeader } from '@/components/screenLayout';
import { CompactTextButton } from '@/components/onboarding';
import { ProfileAvatar } from '@/components/profileAvatar';
import {
  ActionFeedback,
  RecoverableError
} from '@/components/reliability';
import { UserAlias } from '@/components/streakRewards';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { getWeeklyChallengeDisplayStatus } from '@/domain/competition';
import { getPublicInitials } from '@/domain/profile';
import type { StreakCounts } from '@/domain/streaks';
import {
  useEligibleWeeklyChallengePartners,
  useRequestWeeklyChallengePartner,
  useRespondToWeeklyChallengeRequest,
  useWeeklyChallengeRequests
} from '@/data/appDataHooks';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { formatDateKey, useWorkoutProgress } from '@/state/workoutProgress';
import { useProfile } from '@/state/profile';

type PlayerTone = 'cyan' | 'muted';
type WeeklyChallengeFeedback = {
  message: string;
  tone: 'cyan' | 'green' | 'red';
};

export default function SquadScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { regionVerification } = useCompetitionRegion();
  const competitionRegionCode = regionVerification?.regionCode ?? '';
  const { profileImageUri, publicName } = useProfile();
  const { competition, competitionEntryStartDateKey, weeklyGoal } = useWorkoutProgress();
  const activePeriod = competition.currentPeriod;
  const weeklyChallengePeriod = activePeriod?.index ?? 1;
  const eligiblePartnersQuery = useEligibleWeeklyChallengePartners(
    competition.competitionMonthKey,
    weeklyGoal,
    competitionRegionCode,
    weeklyChallengePeriod
  );
  const requestsQuery = useWeeklyChallengeRequests(
    competition.competitionMonthKey,
    weeklyGoal,
    competitionRegionCode,
    weeklyChallengePeriod
  );
  const requestPartner = useRequestWeeklyChallengePartner();
  const respondToRequest = useRespondToWeeklyChallengeRequest();
  const [showBonusDetails, setShowBonusDetails] = useScreenMemory(
    'squad:bonus-details',
    false
  );
  const [showPairingOptions, setShowPairingOptions] = useScreenMemory(
    'squad:pairing-options',
    false
  );
  const [showPairingRules, setShowPairingRules] = useScreenMemory(
    'squad:pairing-rules',
    false
  );
  const [handledRequestIds, setHandledRequestIds] = useScreenMemory<
    readonly string[]
  >(
    `squad:${competition.competitionMonthKey}:${weeklyChallengePeriod}:handled-request-ids`,
    []
  );
  const [acceptedPartnerAlias, setAcceptedPartnerAlias] = useScreenMemory<
    string | null
  >(
    `squad:${competition.competitionMonthKey}:${weeklyChallengePeriod}:accepted-partner`,
    null
  );
  const [weeklyChallengeFeedback, setWeeklyChallengeFeedback] =
    useState<WeeklyChallengeFeedback | null>(null);
  const viewedInviteRef = useRef<string | null>(null);
  const isRemainderDayPhase =
    competition.phase === 'bonus-days' && competition.bonusDateKeys.length > 0;
  const matchInitials = activePeriod ? getInitials(activePeriod.opponentAlias) : '--';
  const bonusStatus = activePeriod
    ? getBonusStatus(activePeriod, weeklyGoal)
    : 'NOT STARTED';
  const bonusEndDay = Number(competition.bonusDateKeys.at(-1)?.slice(-2) ?? 28);
  const incomingRequest = (requestsQuery.data ?? []).find(
    ({ direction, id }) =>
      direction === 'incoming' && !handledRequestIds.includes(id)
  );
  const featuredPartner = (eligiblePartnersQuery.data ?? []).find(
    ({ requestStatus }) => requestStatus !== 'pending'
  ) ?? (eligiblePartnersQuery.data ?? [])[0];
  const pairingRequired =
    !isRemainderDayPhase && activePeriod?.availability !== 'matched';
  const pairingActionRequired = pairingRequired && !acceptedPartnerAlias;
  const challengeState = acceptedPartnerAlias
    ? 'PARTNER CONFIRMED'
    : getWeeklyChallengeDisplayStatus({
        activeAvailability: activePeriod?.availability,
        hasFeaturedPartner: Boolean(featuredPartner),
        hasIncomingRequest: Boolean(incomingRequest),
        isRemainderDayPhase
      });
  const pairingDataError =
    pairingActionRequired &&
    (eligiblePartnersQuery.isError || requestsQuery.isError);
  const pairingDataLoading =
    pairingActionRequired &&
    (eligiblePartnersQuery.isLoading || requestsQuery.isLoading);

  useEffect(() => {
    if (!incomingRequest || viewedInviteRef.current === incomingRequest.id) {
      return;
    }

    viewedInviteRef.current = incomingRequest.id;
    void recordFlowMetric(
      user?.uid,
      'challenge-invite-viewed',
      'weekly-challenge'
    );
  }, [incomingRequest, user?.uid]);

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey="squad"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <BrandScreenHeader
          accessory={(
            <InlineHelpButton
              label="Open contest guide"
              onPress={() => router.push('/how-it-works?from=challenge')}
            />
          )}
          eyebrow={challengeState}
          title={activePeriod ? `WEEK ${activePeriod.index} CHALLENGE` : 'WEEKLY CHALLENGE'}
        />

        <CompetitionHubNav active="challenge" style={styles.hubNav} />

        {pairingDataError ? (
          <RecoverableError
            body="Partner invitations could not be loaded. Retry without leaving this screen."
            onRetry={() => {
              void recordFlowMetric(
                user?.uid,
                'flow-retry',
                'weekly-challenge'
              );
              void Promise.all([
                eligiblePartnersQuery.refetch(),
                requestsQuery.refetch()
              ]);
            }}
            retrying={
              eligiblePartnersQuery.isFetching ||
              requestsQuery.isFetching
            }
            style={styles.queryState}
            title="COULD NOT LOAD INVITES"
          />
        ) : pairingDataLoading ? (
          <TerminalText live="polite" style={styles.queryState} tone="muted" variant="label">
            CHECKING PARTNER INVITES...
          </TerminalText>
        ) : null}

        {weeklyChallengeFeedback ? (
          <ActionFeedback
            message={weeklyChallengeFeedback.message}
            style={styles.queryState}
            tone={weeklyChallengeFeedback.tone}
          />
        ) : null}

        {!pairingDataError && !pairingDataLoading && incomingRequest && pairingActionRequired ? (
          <HUDBorderBox style={styles.partnerRequestCard} tone="amber">
            <TerminalText tone="amber" variant="label">
              RESPOND TO INVITE
            </TerminalText>
            <View style={styles.partnerIdentity}>
              <UserAlias
                alias={incomingRequest.partnerAlias}
                prefix="@"
                streaks={incomingRequest.partnerStreaks}
              />
              <TerminalText tone="dim" variant="micro">
                SAME {weeklyGoal}-DAY WEEKLY GOAL
              </TerminalText>
            </View>
            <CyberButtonPrimary
              disabled={respondToRequest.isPending}
              label={respondToRequest.isPending ? 'Responding...' : 'Accept invite'}
              onPress={() =>
                void respondToRequest
                  .mutateAsync({
                    decision: 'accepted',
                    requestId: incomingRequest.id
                  })
                  .then(() => {
                    setHandledRequestIds((current) => [
                      ...new Set([...current, incomingRequest.id])
                    ]);
                    setWeeklyChallengeFeedback(
                      {
                        message: `@${incomingRequest.partnerAlias} is now your Weekly Challenge partner.`,
                        tone: 'green'
                      }
                    );
                    setAcceptedPartnerAlias(incomingRequest.partnerAlias);
                    void recordFlowMetric(
                      user?.uid,
                      'challenge-invite-responded',
                      'weekly-challenge'
                    );
                  })
                  .catch(() => setWeeklyChallengeFeedback({
                    message: 'That invite could not be accepted. Try again.',
                    tone: 'red'
                  }))
              }
            />
            <CompactTextButton
              disabled={respondToRequest.isPending}
              label={respondToRequest.isPending ? 'Responding...' : 'Decline invite'}
              onPress={() =>
                void respondToRequest
                  .mutateAsync({
                    decision: 'declined',
                    requestId: incomingRequest.id
                  })
                  .then(() => {
                    setHandledRequestIds((current) => [
                      ...new Set([...current, incomingRequest.id])
                    ]);
                    setWeeklyChallengeFeedback({
                      message: 'Weekly Challenge invite declined.',
                      tone: 'cyan'
                    });
                    void recordFlowMetric(
                      user?.uid,
                      'challenge-invite-responded',
                      'weekly-challenge'
                    );
                  })
                  .catch(() => setWeeklyChallengeFeedback({
                    message: 'That invite could not be declined. Try again.',
                    tone: 'red'
                  }))
              }
              tone="muted"
            />
            <PairingMoreOptions
              onManageFriends={() => router.push('/squad/social')}
              onToggleOptions={() => setShowPairingOptions((current) => !current)}
              onToggleRules={() => setShowPairingRules((current) => !current)}
              showOptions={showPairingOptions}
              showRules={showPairingRules}
            />
          </HUDBorderBox>
        ) : null}

        <FirstVisitTip
          body="Hit your Weekly Goal with a partner for 2x. If they miss, one extra workout can unlock 3x."
          onOpenGuide={() => router.push('/how-it-works?from=challenge')}
          style={styles.firstVisitTip}
          tip="weekly-challenge"
        />

        {activePeriod ? (
          <HUDBorderBox style={styles.pactCard} tone="cyan">
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

            <View style={styles.matchNote}>
              <TerminalText
                style={styles.matchNoteText}
                tone="cyan"
                uppercase={false}
                variant="body"
              >
                {getMatchNote(activePeriod, weeklyGoal)}
              </TerminalText>
            </View>
          </HUDBorderBox>
        ) : isRemainderDayPhase ? (
          <HUDBorderBox style={styles.pactCard} tone="cyan">
            <TerminalText tone="cyan" variant="label">
              DAYS 29-{bonusEndDay}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" uppercase={false} variant="body">
              Weekly Challenges are complete. Each verified Bonus Day adds {weeklyGoal}{' '}
              Prize Draw {weeklyGoal === 1 ? 'Entry' : 'Entries'} before the Perfect Month 10x.
            </TerminalText>
          </HUDBorderBox>
        ) : (
          <HUDBorderBox style={styles.pactCard} tone="cyan">
            <TerminalText tone="cyan" variant="label">
              {acceptedPartnerAlias ? 'PARTNER READY' : 'FIRST ELIGIBLE WEEK'}
            </TerminalText>
            <TerminalText style={styles.pendingDate} tone="text" variant="title">
              {formatDateKey(competitionEntryStartDateKey)}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" uppercase={false} variant="body">
              {acceptedPartnerAlias
                ? `@${acceptedPartnerAlias} is confirmed. Your first Weekly Challenge begins on this date.`
                : 'Choose an eligible friend or wait for automatic pairing when scoring starts.'}
            </TerminalText>
          </HUDBorderBox>
        )}

        {activePeriod ? (
          <HUDBorderBox style={styles.forfeitCard} tone="pink">
            <View style={styles.bonusSummary}>
              <View style={styles.bonusSummaryCopy}>
                <TerminalText tone="dim" variant="micro">
                  WEEKLY BONUS STATUS
                </TerminalText>
                <TerminalText glow tone="pink" variant="body">
                  {bonusStatus}
                </TerminalText>
              </View>
              <CompactTextButton
                label={showBonusDetails ? 'Hide details' : 'View details'}
                onPress={() => setShowBonusDetails((current) => !current)}
                tone={showBonusDetails ? 'muted' : 'pink'}
              />
            </View>
            {showBonusDetails ? (
              <TerminalText style={styles.forfeitCopy} tone="muted" uppercase={false} variant="body">
                Both players hit the goal: 2x each. If your partner misses, one
                extra Verified workout upgrades your week to 3x. The upgrade is
                automatic when no extra workout day is available.
              </TerminalText>
            ) : null}
          </HUDBorderBox>
        ) : null}

        {pairingActionRequired && !pairingDataError && !pairingDataLoading && !incomingRequest ? (
          <HUDBorderBox style={styles.partnerRequestCard} tone="cyan">
            {featuredPartner ? (
              <>
                <TerminalText glow tone="cyan" variant="label">
                  INVITE A PARTNER
                </TerminalText>
                <View style={styles.partnerRow}>
                  <View style={styles.partnerIdentity}>
                    <UserAlias
                      alias={featuredPartner.alias}
                      prefix="@"
                      streaks={featuredPartner.streaks}
                    />
                    <TerminalText tone="dim" variant="micro">
                      SAME {featuredPartner.goalDays}-DAY WEEKLY GOAL
                    </TerminalText>
                  </View>
                </View>
                <CyberButtonPrimary
                  disabled={requestPartner.isPending || featuredPartner.requestStatus === 'pending'}
                  label={featuredPartner.requestStatus === 'pending' ? 'Invite sent' : 'Send invite'}
                  onPress={() =>
                    void requestPartner
                      .mutateAsync({
                        competitionMonthKey: competition.competitionMonthKey,
                        periodIndex: weeklyChallengePeriod,
                        recipientUserId: featuredPartner.userId,
                        regionCode: competitionRegionCode,
                        weeklyGoal
                      })
                      .then(() => setWeeklyChallengeFeedback({
                        message: `Invite sent to @${featuredPartner.alias}.`,
                        tone: 'green'
                      }))
                      .catch(() => setWeeklyChallengeFeedback({
                        message: 'That invite could not be sent. Try again.',
                        tone: 'red'
                      }))
                  }
                />
              </>
            ) : (
              <>
                <TerminalText glow tone="cyan" variant="label">
                  PAIRING NOT STARTED
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="body">
                  We&apos;ll look for an eligible partner when pairing opens.
                </TerminalText>
              </>
            )}

            <PairingMoreOptions
              onManageFriends={() => router.push('/squad/social')}
              onToggleOptions={() => setShowPairingOptions((current) => !current)}
              onToggleRules={() => setShowPairingRules((current) => !current)}
              showOptions={showPairingOptions}
              showRules={showPairingRules}
            />

          </HUDBorderBox>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function PairingMoreOptions({
  onManageFriends,
  onToggleOptions,
  onToggleRules,
  showOptions,
  showRules
}: {
  onManageFriends: () => void;
  onToggleOptions: () => void;
  onToggleRules: () => void;
  showOptions: boolean;
  showRules: boolean;
}) {
  return (
    <View style={styles.moreOptions}>
      <CompactTextButton
        label={showOptions ? 'Hide pairing options' : 'Pairing options'}
        onPress={onToggleOptions}
        tone="muted"
      />
      {showOptions ? (
        <View style={styles.moreOptionsContent}>
          <CompactTextButton
            label={showRules ? 'Hide pairing rules' : 'Pairing rules'}
            onPress={onToggleRules}
            tone={showRules ? 'muted' : 'cyan'}
          />
          {showRules ? (
            <TerminalText style={styles.partnerRequestCopy} tone="muted" uppercase={false} variant="caption">
              Partners must be in the same regional contest with the same Weekly Goal.
              An invite becomes active only after it is accepted.
            </TerminalText>
          ) : null}
          <CompactTextButton
            label="Manage friends"
            onPress={onManageFriends}
            tone="muted"
          />
        </View>
      ) : null}
    </View>
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

function getMatchNote(
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>,
  weeklyGoal: number
) {
  if (period.availability === 'solo') {
    return `No compatible partner was available. Hit ${weeklyGoal} Verified workout days for the standard 1x result.`;
  }

  if (period.userGoalMet && period.opponentGoalMet) {
    return `Both players hit ${weeklyGoal}. The 2x result is secured when this week closes.`;
  }

  if (period.userGoalMet && period.bonusWorkoutCompleted) {
    return weeklyGoal === 7
      ? 'Your seven-day goal is complete. 3x activates automatically if your partner misses.'
      : 'Your extra Verified workout is complete. 3x is ready if your partner misses.';
  }

  if (period.userGoalMet) {
    return `Your ${weeklyGoal}-day Weekly Goal is complete. Add one more Verified workout to unlock 3x if your partner misses.`;
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
    return '3X BONUS READY';
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
        <View
          style={[
            styles.playerAvatar,
            isMuted ? styles.playerAvatarMuted : styles.playerAvatarCyan
          ]}
        >
          <TerminalText
            style={isMuted ? styles.playerInitialsLight : styles.playerInitialsDark}
            tone="text"
            variant="button"
          >
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
    backgroundColor: colors.transparent
  },
  hubNav: {
    marginBottom: spacing.lg
  },
  queryState: {
    marginBottom: spacing.lg
  },
  firstVisitTip: {
    marginBottom: spacing.lg
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
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
  bonusSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  bonusSummaryCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
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
  gymUnavailableCard: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  partnerRequestCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  partnerRequestCopy: {
    fontFamily: fontFamilies.body
  },
  moreOptions: {
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted
  },
  moreOptionsContent: {
    gap: spacing.xs,
    paddingBottom: spacing.xs
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    backgroundColor: colors.panelAlpha45
  },
  partnerIdentity: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  confirmedPartner: {
    gap: spacing.xs
  }
});
