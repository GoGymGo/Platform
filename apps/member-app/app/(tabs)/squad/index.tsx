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
import { CompactTextButton } from '@/components/onboarding';
import { ProfileAvatar } from '@/components/profileAvatar';
import { ActionFeedback, RecoverableError } from '@/components/reliability';
import { BrandScreenHeader } from '@/components/screenLayout';
import { UserAlias } from '@/components/streakRewards';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { canLoadWeeklyChallengePairing } from '@/domain/competition';
import { getPublicInitials } from '@/domain/profile';
import type { StreakCounts } from '@/domain/streaks';
import {
  useCancelWeeklyChallengeRequest,
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
  const {
    competition,
    competitionEntryStartDateKey,
    competitionId,
    weeklyGoal
  } = useWorkoutProgress();
  const activePeriod = competition.currentPeriod;
  const pairingDataEnabled = Boolean(competitionId) && canLoadWeeklyChallengePairing({
    hasCurrentPeriod: Boolean(activePeriod),
    phase: competition.phase
  });
  const weeklyChallengePeriod = activePeriod?.index ?? 1;
  const eligiblePartnersQuery = useEligibleWeeklyChallengePartners(
    pairingDataEnabled ? (competitionId ?? '') : '',
    competition.competitionMonthKey,
    weeklyGoal,
    pairingDataEnabled ? competitionRegionCode : '',
    weeklyChallengePeriod
  );
  const requestsQuery = useWeeklyChallengeRequests(
    pairingDataEnabled ? (competitionId ?? '') : '',
    competition.competitionMonthKey,
    weeklyGoal,
    pairingDataEnabled ? competitionRegionCode : '',
    weeklyChallengePeriod
  );
  const requestPartner = useRequestWeeklyChallengePartner();
  const respondToRequest = useRespondToWeeklyChallengeRequest();
  const cancelRequest = useCancelWeeklyChallengeRequest();
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
  const [feedback, setFeedback] = useState<WeeklyChallengeFeedback | null>(null);
  const viewedInviteRef = useRef<string | null>(null);
  const isBonusDayPhase = competition.phase === 'bonus-days';
  const requests = requestsQuery.data ?? [];
  const incomingRequests = requests.filter(
    ({ direction, status }) => direction === 'incoming' && status === 'pending'
  );
  const outgoingRequests = requests.filter(
    ({ direction, status }) => direction === 'outgoing' && status === 'pending'
  );
  const currentIncomingRequest = incomingRequests[0];
  const challengeState = getChallengeState({
    availability: activePeriod?.availability,
    hasIncoming: incomingRequests.length > 0,
    hasOutgoing: outgoingRequests.length > 0,
    isBonusDayPhase,
    scoringStatus: activePeriod?.scoringStatus
  });
  const pairingDataError = pairingDataEnabled && (
    eligiblePartnersQuery.isError || requestsQuery.isError
  );
  const pairingDataLoading = pairingDataEnabled && (
    eligiblePartnersQuery.isLoading || requestsQuery.isLoading
  );

  useEffect(() => {
    if (
      !currentIncomingRequest ||
      viewedInviteRef.current === currentIncomingRequest.id
    ) {
      return;
    }
    viewedInviteRef.current = currentIncomingRequest.id;
    void recordFlowMetric(user?.uid, 'challenge-invite-viewed', 'weekly-challenge');
  }, [currentIncomingRequest, user?.uid]);

  const retryPairingData = () => {
    void recordFlowMetric(user?.uid, 'flow-retry', 'weekly-challenge');
    void Promise.all([
      eligiblePartnersQuery.refetch(),
      requestsQuery.refetch()
    ]);
  };

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
          title={activePeriod ? `WEEK ${activePeriod.index} MATCH` : 'WEEKLY MATCH'}
        />
        <CompetitionHubNav active="challenge" style={styles.hubNav} />

        {pairingDataError ? (
          <RecoverableError
            body="Weekly Match status could not be loaded. No partner assignment was assumed."
            onRetry={retryPairingData}
            retrying={eligiblePartnersQuery.isFetching || requestsQuery.isFetching}
            style={styles.queryState}
            title="COULD NOT LOAD WEEKLY MATCH"
          />
        ) : pairingDataLoading ? (
          <TerminalText live="polite" style={styles.queryState} tone="muted" variant="label">
            LOADING WEEKLY MATCH...
          </TerminalText>
        ) : null}

        {feedback ? (
          <ActionFeedback
            message={feedback.message}
            style={styles.queryState}
            tone={feedback.tone}
          />
        ) : null}

        <FirstVisitTip
          body="GoGymGo automatically assigns another active player with the same Weekly Goal. Your assigned Alias and live progress appear here."
          onOpenGuide={() => router.push('/how-it-works?from=challenge')}
          style={styles.firstVisitTip}
          tip="weekly-challenge"
        />

        {activePeriod ? (
          <ChallengeProgressCard
            period={activePeriod}
            profileImageUri={profileImageUri}
            publicName={publicName}
            weeklyGoal={weeklyGoal}
          />
        ) : isBonusDayPhase ? (
          <HUDBorderBox style={styles.pactCard} tone="cyan">
            <TerminalText tone="cyan" variant="label">WEEKLY MATCHES COMPLETE</TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" uppercase={false} variant="body">
              Only settled weekly entries are banked. Bonus Days are scored separately.
            </TerminalText>
          </HUDBorderBox>
        ) : (
          <HUDBorderBox style={styles.pactCard} tone="cyan">
            <TerminalText tone="cyan" variant="label">NO ACTIVE SCORING WEEK</TerminalText>
            <TerminalText style={styles.pendingDate} tone="text" variant="title">
              {formatDateKey(competitionEntryStartDateKey)}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" uppercase={false} variant="body">
              Automatic matching begins during each active seven-day scoring week.
            </TerminalText>
          </HUDBorderBox>
        )}

        {activePeriod ? (
          <HUDBorderBox style={styles.bonusCard} tone="pink">
            <View style={styles.summaryRow}>
              <View style={styles.summaryCopy}>
                <TerminalText tone="dim" variant="micro">WEEKLY OUTCOME</TerminalText>
                <TerminalText glow tone="pink" variant="body">
                  {activePeriod.scoringStatus === 'settled'
                    ? `${activePeriod.finalMultiplier}X SETTLED · ${activePeriod.entries} BANKED`
                    : `${activePeriod.liveMultiplier}X PROJECTED · ${activePeriod.projectedEntries} PROVISIONAL`}
                </TerminalText>
              </View>
              <CompactTextButton
                label={showBonusDetails ? 'Hide details' : 'View details'}
                onPress={() => setShowBonusDetails((current) => !current)}
                tone={showBonusDetails ? 'muted' : 'pink'}
              />
            </View>
            {showBonusDetails ? (
              <TerminalText style={styles.bonusCopy} tone="muted" uppercase={false} variant="body">
                Missing your goal settles at 0x. Solo completion settles at 1x. Both matched players
                meeting the goal settles at 2x. If your partner misses, you need an eligible
                extra Verified workout to settle at 3x. Projections are never banked entries.
              </TerminalText>
            ) : null}
          </HUDBorderBox>
        ) : null}

        {pairingDataEnabled && !pairingDataError && !pairingDataLoading &&
        activePeriod?.availability !== 'matched' && activePeriod?.scoringStatus !== 'settled' ? (
          <>
            {incomingRequests.map((request) => (
              <HUDBorderBox key={request.id} style={styles.requestCard} tone="amber">
                <TerminalText tone="amber" variant="label">INCOMING INVITE</TerminalText>
                <UserAlias alias={request.partnerAlias} prefix="@" streaks={request.partnerStreaks} />
                <TerminalText tone="dim" variant="micro">SAME {request.goalDays}-DAY WEEKLY GOAL</TerminalText>
                <CyberButtonPrimary
                  disabled={respondToRequest.isPending}
                  label={respondToRequest.isPending ? 'Responding...' : 'Accept invite'}
                  onPress={() => void respondToRequest.mutateAsync({
                    decision: 'accepted',
                    requestId: request.id
                  }).then(() => {
                    setFeedback({
                      message: `@${request.partnerAlias} is confirmed after their explicit invite acceptance.`,
                      tone: 'green'
                    });
                    void recordFlowMetric(user?.uid, 'challenge-invite-responded', 'weekly-challenge');
                  }).catch(() => setFeedback({
                    message: 'That invite could not be accepted. Retry to use the same safe request.',
                    tone: 'red'
                  }))}
                />
                <CompactTextButton
                  disabled={respondToRequest.isPending}
                  label="Decline invite"
                  onPress={() => void respondToRequest.mutateAsync({
                    decision: 'declined',
                    requestId: request.id
                  }).then(() => setFeedback({
                    message: 'Weekly Challenge invite declined.',
                    tone: 'cyan'
                  })).catch(() => setFeedback({
                    message: 'That invite could not be declined. Try again.',
                    tone: 'red'
                  }))}
                  tone="muted"
                />
              </HUDBorderBox>
            ))}

            {outgoingRequests.map((request) => (
              <HUDBorderBox key={request.id} style={styles.requestCard} tone="cyan">
                <TerminalText tone="cyan" variant="label">INVITE SENT</TerminalText>
                <UserAlias alias={request.partnerAlias} prefix="@" streaks={request.partnerStreaks} />
                <TerminalText tone="muted" uppercase={false} variant="body">
                  Waiting for explicit acceptance. You remain unpaired until they accept.
                </TerminalText>
                <CompactTextButton
                  disabled={cancelRequest.isPending}
                  label={cancelRequest.isPending ? 'Cancelling...' : 'Cancel invite'}
                  onPress={() => void cancelRequest.mutateAsync(request.id)
                    .then(() => setFeedback({ message: 'Invite cancelled.', tone: 'cyan' }))
                    .catch(() => setFeedback({
                      message: 'That invite could not be cancelled. Try again.',
                      tone: 'red'
                    }))}
                  tone="muted"
                />
              </HUDBorderBox>
            ))}

            {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
              <HUDBorderBox style={styles.requestCard} tone="cyan">
                <TerminalText glow tone="cyan" variant="label">OPTIONAL: CHOOSE A FRIEND</TerminalText>
                {(eligiblePartnersQuery.data ?? []).length === 0 ? (
                  <TerminalText tone="muted" uppercase={false} variant="body">
                    Automatic matching is still active. No accepted, unblocked friend is currently
                    eligible for this Contest, week, region and Weekly Goal.
                  </TerminalText>
                ) : (
                  (eligiblePartnersQuery.data ?? []).map((partner) => (
                    <View key={partner.userId} style={styles.partnerRow}>
                      <View style={styles.partnerIdentity}>
                        <UserAlias alias={partner.alias} prefix="@" streaks={partner.streaks} />
                        <TerminalText tone="dim" variant="micro">
                          SAME {partner.goalDays}-DAY WEEKLY GOAL
                        </TerminalText>
                      </View>
                      <CompactTextButton
                        disabled={requestPartner.isPending || partner.requestStatus === 'pending'}
                        label={partner.requestStatus === 'pending' ? 'Invite pending' : 'Send invite'}
                        onPress={() => void requestPartner.mutateAsync({
                          competitionId: competitionId!,
                          competitionMonthKey: competition.competitionMonthKey,
                          periodIndex: weeklyChallengePeriod,
                          recipientUserId: partner.userId,
                          regionCode: competitionRegionCode,
                          weeklyGoal
                        }).then(() => setFeedback({
                          message: `Invite sent to @${partner.alias}.`,
                          tone: 'green'
                        })).catch(() => setFeedback({
                          message: 'That invite could not be sent. Retry to reuse the same safe request.',
                          tone: 'red'
                        }))}
                        tone="cyan"
                      />
                    </View>
                  ))
                )}
              </HUDBorderBox>
            ) : null}

            <PairingMoreOptions
              onManageFriends={() => router.push('/squad/social')}
              onToggleOptions={() => setShowPairingOptions((current) => !current)}
              onToggleRules={() => setShowPairingRules((current) => !current)}
              showOptions={showPairingOptions}
              showRules={showPairingRules}
            />
          </>
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function ChallengeProgressCard({
  period,
  profileImageUri,
  publicName,
  weeklyGoal
}: {
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>;
  profileImageUri: string | null;
  publicName: string;
  weeklyGoal: number;
}) {
  const hasPartner = period.availability === 'matched';
  return (
    <HUDBorderBox style={styles.pactCard} tone="cyan">
      {hasPartner ? (
        <>
          <View style={styles.matchupRow}>
            <PlayerBlock
              imageUri={profileImageUri}
              initials={getPublicInitials(publicName)}
              label="YOU"
              progress={`${Math.min(period.userVerifiedCount, 7)} VERIFIED`}
              tone="cyan"
            />
            <TerminalText style={styles.vsText} tone="dim" variant="button">VS</TerminalText>
            <PlayerBlock
              initials={getInitials(period.opponentAlias)}
              label={period.opponentAlias}
              progress={`${period.opponentVerifiedCount} VERIFIED THIS WEEK`}
              streaks={period.opponentStreaks}
              tone="muted"
            />
          </View>
          <View style={styles.partnerStats}>
            <PartnerStat label="CURRENT STREAK" value={period.opponentCurrentStreak} />
            <PartnerStat label="BEST STREAK" value={period.opponentBestStreak} />
            <PartnerStat label="MONTH VERIFIED" value={period.opponentMonthlyVerifiedDays} />
          </View>
        </>
      ) : (
        <>
          <TerminalText tone="cyan" variant="label">
            {period.availability === 'solo' ? 'SOLO RESULT' : 'PAIRING IN PROGRESS'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {period.availability === 'solo'
              ? 'No eligible player remained available. This week uses the solo scoring rule.'
              : `GoGymGo is finding another active player with the same ${weeklyGoal}-day Weekly Goal. This screen refreshes automatically.`}
          </TerminalText>
        </>
      )}
      <View style={styles.selfProgress}>
        <TerminalText tone="dim" variant="micro">YOUR VERIFIED DAYS</TerminalText>
        <TerminalText glow tone="cyan" variant="body">
          {period.userVerifiedCount} / {weeklyGoal}
        </TerminalText>
      </View>
      <TerminalText style={styles.matchNoteText} tone="cyan" uppercase={false} variant="body">
        {getMatchNote(period, weeklyGoal)}
      </TerminalText>
    </HUDBorderBox>
  );
}

function PartnerStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.partnerStat}>
      <TerminalText tone="dim" variant="micro">{label}</TerminalText>
      <TerminalText tone="text" variant="label">{value}</TerminalText>
    </View>
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
    <HUDBorderBox style={styles.requestCard} tone="muted">
      <CompactTextButton
        label={showOptions ? 'Hide pairing options' : 'Pairing options'}
        onPress={onToggleOptions}
        tone="muted"
      />
      {showOptions ? (
        <View style={styles.optionsContent}>
          <CompactTextButton
            label={showRules ? 'Hide rules' : 'Partner rules'}
            onPress={onToggleRules}
            tone={showRules ? 'muted' : 'cyan'}
          />
          {showRules ? (
            <TerminalText tone="muted" uppercase={false} variant="caption">
              Automatic matches use another active, unblocked player in the exact Contest,
              scoring week and Weekly Goal. While pairing is in progress, you can instead invite
              an accepted friend; an invite has no effect until explicitly accepted.
            </TerminalText>
          ) : null}
          <CompactTextButton label="Manage friends" onPress={onManageFriends} tone="muted" />
        </View>
      ) : null}
    </HUDBorderBox>
  );
}

function getChallengeState({
  availability,
  hasIncoming,
  hasOutgoing,
  isBonusDayPhase,
  scoringStatus
}: {
  availability?: 'matched' | 'searching' | 'solo';
  hasIncoming: boolean;
  hasOutgoing: boolean;
  isBonusDayPhase: boolean;
  scoringStatus?: 'projected' | 'settled';
}) {
  if (isBonusDayPhase) return 'WEEKS SETTLED';
  if (scoringStatus === 'settled') return availability === 'matched' ? 'SETTLED' : 'SOLO SETTLED';
  if (availability === 'matched') return 'WEEKLY MATCH ASSIGNED';
  if (hasIncoming) return 'INCOMING INVITE';
  if (hasOutgoing) return 'AWAITING ACCEPTANCE';
  if (availability === 'solo') return 'SOLO';
  return availability === 'searching' ? 'PAIRING IN PROGRESS' : 'NOT ACTIVE';
}

function getMatchNote(
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>,
  weeklyGoal: number
) {
  if (period.scoringStatus === 'settled') {
    return `${period.finalMultiplier}x is settled. ${period.entries} entries are banked for this week.`;
  }
  if (period.availability !== 'matched') {
    return `Meet ${weeklyGoal} Verified workout days while automatic matching continues. Your assigned player will appear here as soon as the server confirms the match.`;
  }
  if (period.userGoalMet && period.opponentGoalMet) {
    return 'Both goals are currently met. The projected result is 2x until settlement.';
  }
  if (period.userGoalMet && period.bonusWorkoutCompleted) {
    return 'Your eligible extra Verified workout is complete. The projected result is 3x if your partner misses.';
  }
  if (period.userGoalMet) {
    return weeklyGoal === 7
      ? 'Your goal is met. A seven-day goal has no eligible extra day, so a missed partner remains projected at 1x.'
      : 'Your goal is met. Add one eligible Verified workout for a projected 3x if your partner misses.';
  }
  const remaining = Math.max(weeklyGoal - period.userVerifiedCount, 0);
  return `${remaining} more Verified ${remaining === 1 ? 'day' : 'days'} needed. Partner progress is ${period.opponentVerifiedCount}/${weeklyGoal}.`;
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
  tone: 'cyan' | 'muted';
}) {
  const isMuted = tone === 'muted';
  return (
    <View style={styles.playerBlock}>
      {imageUri ? (
        <ProfileAvatar imageUri={imageUri} initials={initials} size={50} />
      ) : (
        <View style={[
          styles.playerAvatar,
          isMuted ? styles.playerAvatarMuted : styles.playerAvatarCyan
        ]}>
          <TerminalText tone="text" variant="button">{initials}</TerminalText>
        </View>
      )}
      <UserAlias alias={label} streaks={streaks} style={styles.playerAlias} />
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
  hubNav: { marginBottom: spacing.lg },
  queryState: { marginBottom: spacing.lg },
  firstVisitTip: { marginBottom: spacing.lg },
  pactCard: { gap: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg },
  pendingDate: { marginVertical: spacing.sm, fontFamily: fontFamilies.display },
  matchupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playerBlock: { flex: 1, alignItems: 'center' },
  playerAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14
  },
  playerAvatarCyan: { backgroundColor: colors.cyan, ...cyberGlow.cyan },
  playerAvatarMuted: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft,
    ...cyberGlow.muted
  },
  playerAlias: { justifyContent: 'center', marginTop: spacing.sm },
  playerProgress: { marginTop: 2, fontFamily: fontFamilies.display, textAlign: 'center' },
  vsText: { fontFamily: fontFamilies.display },
  partnerStats: { flexDirection: 'row', gap: spacing.sm },
  partnerStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted
  },
  selfProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  matchNoteText: { fontFamily: fontFamilies.body },
  bonusCard: { gap: spacing.md, marginBottom: spacing.lg, padding: spacing.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryCopy: { minWidth: 0, flex: 1, gap: 2 },
  bonusCopy: { fontFamily: fontFamilies.body },
  requestCard: { gap: spacing.md, marginBottom: spacing.lg, padding: spacing.lg },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    backgroundColor: colors.panelAlpha45
  },
  partnerIdentity: { minWidth: 0, flex: 1, gap: 2 },
  optionsContent: { gap: spacing.sm }
});
