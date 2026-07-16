import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Linking, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';
import { useRewardCatalog } from '@/data/appDataHooks';
import {
  rewardAvailabilityLabel,
  type RewardCatalogItem
} from '@/domain/rewards';
import { goBackOrReplace } from '@/navigation/goBack';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function RewardMarketplaceScreen() {
  const router = useRouter();
  const { competitionRegion } = useCompetitionRegion();
  const { competition } = useWorkoutProgress();
  const { data: rewards = [], isPending } = useRewardCatalog(
    competitionRegion.id,
    competition.competitionMonthKey
  );

  return (
    <ScreenContainer>
      <SponsorBanner compact />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/leaderboard')}
            style={styles.backButton}
          />
          <CyberButtonOutline
            label="MY REWARDS"
            onPress={() => router.push('/rewards/awards')}
            style={styles.myRewardsButton}
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
            These physical products and coupon codes are supplied by participating
            brands for this region&apos;s contest. Prize Draw Entries determine your
            chance of winning; no payment or bank account is required.
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.entryNote} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            HOW WINNERS ARE MATCHED
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            At settlement, the verified draw selects one winner for each available
            reward unit. Every selected player receives the exact item shown in their
            reward award.
          </TerminalText>
        </HUDBorderBox>

        {isPending ? (
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl
  },
  backButton: { width: 96, minHeight: 44 },
  myRewardsButton: { flex: 1, maxWidth: 180, minHeight: 44 },
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
