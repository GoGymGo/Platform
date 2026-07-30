import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Image, Linking, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { CompetitionHubNav } from '@/components/competitionHubNav';
import { CompactTextButton } from '@/components/onboarding';
import { RecoverableError } from '@/components/reliability';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';
import { useRewardCatalog } from '@/data/appDataHooks';
import {
  rewardAvailabilityLabel,
  type RewardCatalogItem
} from '@/domain/rewards';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function RewardMarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [showWinnerDetails, setShowWinnerDetails] = useScreenMemory(
    'reward-marketplace:winner-details',
    false
  );
  const { competitionRegion } = useCompetitionRegion();
  const { competition } = useWorkoutProgress();
  const rewardsQuery = useRewardCatalog(
    competitionRegion.id,
    competition.competitionMonthKey
  );
  const { data: rewards = [], isPending } = rewardsQuery;

  return (
    <ScreenContainer>
      <SponsorBanner compact />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey="reward-marketplace"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <CompetitionHubNav active="rewards" style={styles.hubNav} />
        <View style={styles.myRewardsRow}>
          <CompactTextButton
            label="MY REWARDS ->"
            onPress={() => router.push('/rewards/awards')}
            tone="pink"
          />
        </View>

        <View style={styles.intro}>
          <TerminalText glow tone="pink" variant="label">
            {competitionRegion.label}{' // '}{competition.competitionMonthKey}
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            REWARD MARKETPLACE
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Browse the physical prizes and coupon codes available in this region.
            Prize Draw Entries set your chances; no payment account is required.
          </TerminalText>
          <CompactTextButton
            label={showWinnerDetails ? 'HIDE WINNER DETAILS' : 'HOW WINNERS ARE SELECTED'}
            onPress={() => setShowWinnerDetails((current) => !current)}
            tone={showWinnerDetails ? 'muted' : 'cyan'}
          />
        </View>

        {showWinnerDetails ? <HUDBorderBox style={styles.entryNote} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            HOW WINNERS ARE MATCHED
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            At settlement, the verified draw selects one winner for each available
            reward unit. Every selected player receives the exact item shown in their
            reward award.
          </TerminalText>
        </HUDBorderBox> : null}

        {rewardsQuery.isError ? (
          <RecoverableError
            body="The regional reward catalog could not be loaded. Retry without leaving the marketplace."
            onRetry={() => {
              void recordFlowMetric(user?.uid, 'flow-retry', 'reward-marketplace');
              void rewardsQuery.refetch();
            }}
            retrying={rewardsQuery.isFetching}
            title="COULD NOT LOAD REWARDS"
          />
        ) : isPending ? (
          <TerminalText live="polite" style={styles.empty} tone="muted" variant="label">
            LOADING REGIONAL REWARDS...
          </TerminalText>
        ) : rewards.length === 0 ? (
          <HUDBorderBox style={styles.emptyCard} tone="muted">
            <TerminalText glow tone="muted" variant="label">
              REWARDS PUBLISHING SOON
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Brand rewards for this regional contest have not been published yet.
            </TerminalText>
          </HUDBorderBox>
        ) : (
          <View style={styles.grid}>
            {rewards.map((reward) => <RewardCard key={reward.id} reward={reward} />)}
          </View>
        )}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function RewardCard({ reward }: { reward: RewardCatalogItem }) {
  const inStock = reward.inventoryRemaining > 0;
  const tone = reward.rewardType === 'coupon' ? 'cyan' : 'pink';
  return (
    <HUDBorderBox glow={inStock} style={styles.rewardCard} tone={inStock ? tone : 'muted'}>
      {reward.imageUrl ? (
        <Image
          accessibilityLabel={`${reward.title} reward image`}
          source={{ uri: reward.imageUrl }}
          style={styles.rewardImage}
        />
      ) : (
        <View
          accessibilityLabel={`${reward.title} reward illustration`}
          accessibilityRole="image"
          style={[styles.imagePlaceholder, reward.rewardType === 'coupon' ? styles.couponVisual : null]}
        >
          <View style={[styles.rewardIcon, reward.rewardType === 'coupon' ? styles.rewardIconCyan : styles.rewardIconPink]}>
            <Ionicons
              color={reward.rewardType === 'coupon' ? colors.cyan : colors.pink}
              name={reward.rewardType === 'coupon'
                ? 'pricetag-outline'
                : reward.title.toLowerCase().includes('hoodie')
                  ? 'shirt-outline'
                  : 'barbell-outline'}
              size={48}
            />
          </View>
          <View style={styles.visualCopy}>
            <TerminalText glow tone={inStock ? tone : 'muted'} variant="label">
              {reward.sponsorName}
            </TerminalText>
            <TerminalText tone="muted" variant="micro">
              {reward.rewardType === 'coupon' ? 'DIGITAL REWARD' : 'PHYSICAL REWARD'}
            </TerminalText>
          </View>
        </View>
      )}
      <View style={styles.rewardCopy}>
        <View style={styles.rewardMeta}>
          <TerminalText glow tone={tone} variant="micro">
            {reward.rewardType === 'coupon' ? 'COUPON CODE' : 'PHYSICAL PRIZE'}
          </TerminalText>
          <TerminalText tone={inStock ? 'green' : 'muted'} variant="micro">
            {rewardAvailabilityLabel(reward)}
          </TerminalText>
        </View>
        <TerminalText style={styles.rewardTitle} tone="text" variant="body">
          {reward.title}
        </TerminalText>
        <TerminalText tone="cyan" variant="micro">
          OFFERED BY {reward.sponsorName}
        </TerminalText>
        <TerminalText tone="muted" uppercase={false} variant="body">
          {reward.description}
        </TerminalText>
        {reward.termsUrl ? (
          <CyberButtonOutline
            label="VIEW BRAND TERMS"
            onPress={() => void Linking.openURL(reward.termsUrl!)}
            style={styles.termsButton}
            tone={tone}
          />
        ) : null}
      </View>
    </HUDBorderBox>
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
  hubNav: {
    marginBottom: spacing.sm
  },
  myRewardsRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg
  },
  intro: { gap: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: fontFamilies.display },
  entryNote: { gap: spacing.sm, marginBottom: spacing.xl, padding: spacing.lg },
  grid: { gap: spacing.lg },
  rewardCard: { overflow: 'hidden', padding: 0, borderRadius: radii.lg },
  rewardImage: { width: '100%', height: 180, backgroundColor: colors.panelSoft },
  imagePlaceholder: {
    height: 156,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.surfacePrizeDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPinkMuted
  },
  couponVisual: {
    backgroundColor: colors.panelSoft,
    borderBottomColor: colors.borderCyanMuted
  },
  rewardIcon: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20
  },
  rewardIconPink: {
    borderColor: colors.borderPinkGlow,
    backgroundColor: colors.surfacePinkStrong
  },
  rewardIconCyan: {
    borderColor: colors.borderCyanGlow,
    backgroundColor: colors.surfaceCyanStrong
  },
  visualCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  rewardCopy: { gap: spacing.sm, padding: spacing.lg },
  rewardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  rewardTitle: { fontFamily: fontFamilies.display },
  termsButton: { minHeight: 44, marginTop: spacing.xs },
  empty: { paddingVertical: spacing.xxl, textAlign: 'center' },
  emptyCard: { gap: spacing.sm, padding: spacing.xl }
});
