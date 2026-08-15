import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import {
  getUserFacingErrorMessage,
  InlineLoadingState,
  RecoverableError,
  useAccessibilityAnnouncement
} from '@/components/reliability';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useClaimReward, useMyRewardAwards } from '@/data/appDataHooks';
import type { ClaimedReward, RewardAward } from '@/domain/rewards';
import { goBackOrReplace } from '@/navigation/goBack';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';

export default function MyAwardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const awardsQuery = useMyRewardAwards();
  const { data: awards = [], isPending } = awardsQuery;
  const claim = useClaimReward();
  const claimedReward = claim.data;
  const viewedRewardsRef = useRef(false);
  const completedClaimRef = useRef<string | null>(null);
  const hasClaimableReward = awards.some(
    ({ rewardType, status }) => rewardType !== "cash" && status === "awarded",
  );

  useEffect(() => {
    if (!hasClaimableReward || viewedRewardsRef.current) {
      return;
    }
    viewedRewardsRef.current = true;
    void recordFlowMetric(user?.uid, 'reward-claim-viewed', 'my-rewards');
  }, [hasClaimableReward, user?.uid]);

  useEffect(() => {
    if (!claimedReward || completedClaimRef.current === claimedReward.id) {
      return;
    }
    completedClaimRef.current = claimedReward.id;
    void recordFlowMetric(user?.uid, 'reward-claim-completed', 'my-rewards');
  }, [claimedReward, user?.uid]);

  const retryClaim = () => {
    const awardId = claim.variables?.awardId;
    if (!awardId) {
      return;
    }
    void recordFlowMetric(user?.uid, 'flow-retry', 'my-rewards');
    claim.mutate({ awardId });
  };

  return (
    <AuthGate>
      <ScreenContainer>
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          memoryKey="my-rewards"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            label="AWARDS"
            onBack={() => goBackOrReplace(router, '/leaderboard/rewards')}
            step="MY ACCOUNT"
          />
          <BrandScreenHeader
            accent="pink"
            description="Claim a physical Award or coupon here. A cash Award stays pending until an authorized administrator records the completed in-person handoff; this app never initiates a transfer or asks for banking information."
            eyebrow="CONTEST AWARDS"
            title="MY AWARDS"
          />

          {claimedReward ? <ClaimResult reward={claimedReward} /> : null}

          {awardsQuery.isError ? (
            <RecoverableError
              body="Your Award list could not be loaded. Retry to check for Awards; no claim data has been lost."
              onRetry={() => {
                void recordFlowMetric(user?.uid, 'flow-retry', 'my-rewards');
                void awardsQuery.refetch();
              }}
              retrying={awardsQuery.isFetching}
              title="COULD NOT LOAD AWARDS"
            />
          ) : isPending ? (
            <InlineLoadingState label="Loading your Awards..." />
          ) : awards.length === 0 ? (
            <HUDBorderBox style={styles.emptyCard} tone="muted">
              <TerminalText glow tone="muted" variant="label">
                NO AWARDS YET
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                When a Reward is awarded to you, the Award will appear here.
              </TerminalText>
            </HUDBorderBox>
          ) : (
            <View style={styles.awards}>
              {awards.map((award) => (
                <AwardCard
                  award={award}
                  busy={claim.isPending && claim.variables?.awardId === award.id}
                  disabled={claim.isPending}
                  key={award.id}
                  onClaim={() => claim.mutate({ awardId: award.id })}
                />
              ))}
            </View>
          )}
          {claim.error ? (
            <RecoverableError
              body={getUserFacingErrorMessage(
                claim.error,
                'Your Award could not be claimed. It is still available; try again.'
              )}
              onRetry={retryClaim}
              retrying={claim.isPending}
              title="CLAIM DID NOT COMPLETE"
            />
          ) : null}
        </ScreenScrollView>
      </ScreenContainer>
    </AuthGate>
  );
}

function AwardCard({
  award,
  busy,
  disabled,
  onClaim
}: {
  award: RewardAward;
  busy: boolean;
  disabled: boolean;
  onClaim: () => void;
}) {
  const claimable =
    award.rewardType !== "cash" &&
    (award.status === "awarded" || award.status === "claimed");
  return (
    <HUDBorderBox style={styles.awardCard} tone="pink">
      <TerminalText tone="pink" variant="micro">
        #{award.awardRank} {" // "}
        {award.rewardType === "coupon"
          ? "COUPON CODE"
          : award.rewardType === "cash"
            ? "CASH PRIZE"
            : "PHYSICAL PRIZE"}
      </TerminalText>
      <TerminalText style={styles.awardTitle} tone="text" variant="body">
        {award.title}
      </TerminalText>
      <TerminalText tone="cyan" variant="micro">
        OFFERED BY {award.sponsorName}
      </TerminalText>
      <TerminalText tone="muted" variant="micro">
        STATUS {"//"} {getAwardStatusLabel(award)}
      </TerminalText>
      {award.rewardType === "cash" ? (
        <TerminalText tone="muted" uppercase={false} variant="body">
          {formatCashAward(award)}. GoGymGo records only the completed in-person
          cash handoff; no transfer is initiated in the app.
        </TerminalText>
      ) : null}
      {claimable ? (
        <CyberButtonPrimary
          accessibilityHint={award.status === 'claimed'
            ? 'Review the claim details for this Award'
            : 'Reveal the claim instructions for this Award'}
          disabled={disabled}
          label={busy ? 'Claiming...' : award.status === 'claimed' ? 'View claim' : 'Claim Award'}
          onPress={onClaim}
          style={styles.claimButton}
          tone="pink"
        />
      ) : null}
    </HUDBorderBox>
  );
}

function getAwardStatusLabel(award: RewardAward) {
  switch (award.status) {
    case "awarded":
      return award.rewardType === "cash"
        ? "PENDING IN-PERSON HANDOFF"
        : "READY TO CLAIM";
    case "claimed":
      return "CLAIMED // VIEW DETAILS";
    case "fulfilled":
      return award.rewardType === "cash" && award.fulfilledAt
        ? `IN-PERSON HANDOFF RECORDED ${new Date(award.fulfilledAt).toLocaleDateString("en-CA")}`
        : "FULFILLED";
    case "redeemed":
      return "REDEEMED";
    case "cancelled":
      return "UNAVAILABLE";
  }
}

function formatCashAward(award: RewardAward) {
  if (award.cashAmountCents === null || !award.cashCurrency) {
    return "Cash value unavailable";
  }
  return `${new Intl.NumberFormat("en-CA", {
    currency: award.cashCurrency,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(award.cashAmountCents / 100)} ${award.cashCurrency}`;
}

function ClaimResult({ reward }: { reward: ClaimedReward }) {
  useAccessibilityAnnouncement(`${reward.title} Award claimed.`);

  return (
    <HUDBorderBox glow style={styles.claimResult} tone="green">
      <TerminalText glow tone="green" variant="label">
        AWARD CLAIMED
      </TerminalText>
      <TerminalText style={styles.awardTitle} tone="text" variant="body">
        {reward.title}
      </TerminalText>
      {reward.couponCode ? (
        <View style={styles.codeBox}>
          <TerminalText tone="muted" variant="micro">YOUR COUPON CODE</TerminalText>
          <TerminalText glow tone="green" variant="title">
            {reward.couponCode}
          </TerminalText>
        </View>
      ) : null}
      {reward.fulfillmentInstructions ? (
        <TerminalText tone="muted" uppercase={false} variant="body">
          {reward.fulfillmentInstructions}
        </TerminalText>
      ) : null}
      {reward.claimUrl ? (
        <CyberButtonOutline
          label="OPEN SPONSOR REWARD PAGE"
          onPress={() => void Linking.openURL(reward.claimUrl!)}
          tone="green"
        />
      ) : null}
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  content: brandScreenStyles.content,
  awards: { gap: spacing.lg },
  awardCard: { gap: spacing.sm, padding: spacing.lg },
  awardTitle: { fontFamily: fontFamilies.display },
  claimButton: { marginTop: spacing.sm },
  claimResult: { gap: spacing.md, marginBottom: spacing.xl, padding: spacing.lg },
  codeBox: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess
  },
  empty: { paddingVertical: spacing.xxl, textAlign: 'center' },
  emptyCard: { gap: spacing.sm, padding: spacing.xl }
});
