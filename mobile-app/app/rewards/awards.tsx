import { useRouter } from 'expo-router';
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
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useClaimReward, useMyRewardAwards } from '@/data/appDataHooks';
import type { ClaimedReward, RewardAward } from '@/domain/rewards';

export default function MyRewardsScreen() {
  const router = useRouter();
  const { data: awards = [], isPending } = useMyRewardAwards();
  const claim = useClaimReward();
  const claimedReward = claim.data;

  return (
    <AuthGate>
      <ScreenContainer>
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <CyberButtonOutline
            label="BACK TO MARKETPLACE"
            onPress={() => router.replace('/leaderboard/rewards')}
            style={styles.backButton}
          />
          <View style={styles.header}>
            <TerminalText glow tone="pink" variant="label">
              CONTEST REWARDS
            </TerminalText>
            <TerminalText glow style={styles.title} tone="cyan" variant="title">
              MY REWARDS
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Claim physical-prize instructions or securely reveal an awarded coupon
              code. GoGymGo will never ask for banking information.
            </TerminalText>
          </View>

          {claimedReward ? <ClaimResult reward={claimedReward} /> : null}

          {isPending ? (
            <TerminalText live="polite" style={styles.empty} tone="muted" variant="label">
              LOADING YOUR REWARDS...
            </TerminalText>
          ) : awards.length === 0 ? (
            <HUDBorderBox style={styles.emptyCard} tone="muted">
              <TerminalText glow tone="muted" variant="label">
                NO REWARDS YET
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                When you win a physical prize or coupon code, it will appear here.
              </TerminalText>
            </HUDBorderBox>
          ) : (
            <View style={styles.awards}>
              {awards.map((award) => (
                <AwardCard
                  award={award}
                  busy={claim.isPending && claim.variables?.awardId === award.id}
                  key={award.id}
                  onClaim={() => claim.mutate({
                    awardId: award.id,
                    idempotencyKey: `${award.id}:${Date.now()}`
                  })}
                />
              ))}
            </View>
          )}
          {claim.error ? (
            <TerminalText live="assertive" tone="red" uppercase={false} variant="caption">
              {claim.error.message}
            </TerminalText>
          ) : null}
        </ScreenScrollView>
      </ScreenContainer>
    </AuthGate>
  );
}

function AwardCard({
  award,
  busy,
  onClaim
}: {
  award: RewardAward;
  busy: boolean;
  onClaim: () => void;
}) {
  const claimable = award.status === 'awarded' || award.status === 'claimed';
  return (
    <HUDBorderBox glow style={styles.awardCard} tone="pink">
      <TerminalText glow tone="pink" variant="micro">
        #{award.awardRank} {' // '}
        {award.rewardType === 'coupon' ? 'COUPON CODE' : 'PHYSICAL PRIZE'}
      </TerminalText>
      <TerminalText style={styles.awardTitle} tone="text" variant="body">
        {award.title}
      </TerminalText>
      <TerminalText tone="cyan" variant="micro">
        OFFERED BY {award.sponsorName}
      </TerminalText>
      <TerminalText tone="muted" variant="micro">
        STATUS {'//'} {award.status.replace('_', ' ')}
      </TerminalText>
      {claimable ? (
        <CyberButtonPrimary
          accessibilityHint={award.status === 'claimed'
            ? 'Review the claim details for this reward'
            : 'Reveal the claim instructions for this reward'}
          disabled={busy}
          label={busy ? 'CLAIMING...' : award.status === 'claimed' ? 'VIEW CLAIM' : 'CLAIM REWARD'}
          onPress={onClaim}
          style={styles.claimButton}
          tone="pink"
        />
      ) : null}
    </HUDBorderBox>
  );
}

function ClaimResult({ reward }: { reward: ClaimedReward }) {
  return (
    <HUDBorderBox glow style={styles.claimResult} tone="green">
      <TerminalText glow tone="green" variant="label">
        REWARD CLAIMED
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
          label="OPEN SPONSOR CLAIM PAGE"
          onPress={() => void Linking.openURL(reward.claimUrl!)}
          tone="green"
        />
      ) : null}
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  backButton: { alignSelf: 'flex-start', minHeight: 44, marginBottom: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.xl },
  title: { fontFamily: fontFamilies.display },
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
