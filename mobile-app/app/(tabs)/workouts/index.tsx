import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, componentSizes, cyberGlow, fontFamilies, interactionStates, radii, spacing } from '@/constants/theme';
import type { CreatorWorkout } from '@/data/appData';
import { useCreatorWorkouts } from '@/data/appDataHooks';
import { getCreatorWorkoutsReturnTarget } from '@/navigation/creatorWorkouts';
import { formatCampaignCurrency, useSponsorCampaign } from '@/state/sponsorCampaign';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { campaign, economics } = useSponsorCampaign();
  const sponsorConfirmed = campaign.status === 'approved';
  const { data: creatorWorkouts = [], isPending: creatorWorkoutsPending } =
    useCreatorWorkouts();
  const returnTarget = getCreatorWorkoutsReturnTarget(source);

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            FOLLOW ALONG // {campaign.region}
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            CREATOR WORKOUTS
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.infoNote} tone="cyan">
          <TerminalText glow style={styles.infoMark} tone="cyan" variant="label">
            INFO
          </TerminalText>
          <TerminalText style={styles.infoCopy} tone="cyan" uppercase={false} variant="body">
            Choose a regional follow-along workout, start a verified GoGymGo
            session, then play the video. Video views alone never earn entries.
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.workoutList}>
          {creatorWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
            />
          ))}
          {!creatorWorkoutsPending && creatorWorkouts.length === 0 ? (
            <HUDBorderBox style={styles.emptyCard} tone="muted">
              <TerminalText glow tone="amber" variant="label">
                CREATOR WORKOUTS COMING SOON
              </TerminalText>
              <TerminalText style={styles.emptyCopy} tone="muted" variant="body">
                FEATURED REGIONAL WORKOUTS WILL APPEAR AFTER THE CREATOR CATALOG IS CONNECTED.
              </TerminalText>
            </HUDBorderBox>
          ) : null}
        </View>

        <HUDBorderBox style={styles.sponsorCard} tone="muted">
          <View style={[styles.sponsorCardMark, !sponsorConfirmed && styles.sponsorCardMarkPending]}>
            <TerminalText glow tone={sponsorConfirmed ? 'pink' : 'amber'} variant="title">
              {campaign.sponsor.mark}
            </TerminalText>
          </View>
          <View style={styles.sponsorCardCopy}>
            <TerminalText tone="dim" variant="micro">
              CREATOR PROGRAM
            </TerminalText>
            <TerminalText style={styles.sponsorCardTitle} tone="text" variant="body">
              {sponsorConfirmed
                ? `CREATOR PAYOUT POOL: ${formatCampaignCurrency(economics.creatorPayoutAmount)}`
                : 'REGIONAL CREATOR CAMPAIGN'}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {sponsorConfirmed
                ? `Sponsor funding supports the selected ${campaign.region} workout leader.`
                : 'Creator payout details are published with the regional campaign.'}
            </TerminalText>
          </View>
        </HUDBorderBox>

        <CyberButtonOutline
          label={returnTarget.label}
          onPress={() => router.replace(returnTarget.href)}
          style={styles.backButton}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function WorkoutCard({
  workout
}: {
  workout: CreatorWorkout;
}) {
  const router = useRouter();
  const badgeTone = workout.joined ? 'cyan' : 'muted';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !workout.joined }}
      disabled={!workout.joined}
      onPress={() => router.push(`/workouts/${workout.id}`)}
      style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
    >
      <HUDBorderBox glow={workout.joined} style={styles.workoutCard} tone={workout.joined ? 'cyan' : 'muted'}>
        <View style={[
          styles.workoutPreview,
          workout.joined ? styles.workoutPreviewActive : styles.workoutPreviewLocked
        ]}>
          <View style={styles.badgeRow}>
            <HUDBorderBox style={styles.creatorBadge} tone="cyan">
              <TerminalText glow tone="cyan" variant="micro">
                CREATOR
              </TerminalText>
            </HUDBorderBox>
            <HUDBorderBox style={styles.joinedBadge} tone={badgeTone}>
              <TerminalText glow={workout.joined} tone={workout.joined ? 'cyan' : 'muted'} variant="micro">
                {workout.joined ? 'FEATURED' : 'COMING SOON'}
              </TerminalText>
            </HUDBorderBox>
          </View>
          <View style={[styles.playCircle, !workout.joined ? styles.playCircleLocked : null]}>
            <TerminalText glow={workout.joined} tone={workout.joined ? 'cyan' : 'muted'} variant="micro">
              {workout.joined ? 'PLAY' : 'LOCKED'}
            </TerminalText>
          </View>
        </View>
        <View style={styles.workoutCopy}>
          <TerminalText style={styles.workoutTitle} tone="text" uppercase variant="body">
            {workout.name}
          </TerminalText>
          <View style={styles.metaRow}>
            <TerminalText style={styles.rewardText} tone="muted" variant="body">
              {workout.reward}
            </TerminalText>
          </View>
          <TerminalText style={styles.timing} tone="dim" variant="micro">
            {workout.timing}
          </TerminalText>
        </View>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: componentSizes.tabScreenBottomInset,
    backgroundColor: colors.background
  },
  header: {
    marginBottom: spacing.lg
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: spacing.lg,
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  infoMark: {
    fontFamily: fontFamilies.display
  },
  infoCopy: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  sponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  sponsorCardMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: radii.md,
    backgroundColor: colors.surfacePinkSoft
  },
  sponsorCardMarkPending: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  sponsorCardCopy: {
    flex: 1
  },
  sponsorCardTitle: {
    marginVertical: spacing.xs,
    fontFamily: fontFamilies.display
  },
  workoutList: {
    gap: 13
  },
  pressableCard: {
    width: '100%',
    ...interactionStates.webFocus
  },
  workoutCard: {
    overflow: 'hidden',
    padding: 0
  },
  workoutPreview: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md
  },
  workoutPreviewActive: {
    backgroundColor: colors.surfaceCyanSubtle
  },
  workoutPreviewLocked: {
    backgroundColor: colors.panelSoft
  },
  badgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  creatorBadge: {
    width: 'auto',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6
  },
  joinedBadge: {
    width: 'auto',
    paddingVertical: spacing.xs,
    paddingHorizontal: 9,
    borderRadius: 6
  },
  playCircle: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: 23,
    backgroundColor: colors.surfaceCyanProgress,
    ...cyberGlow.cyan
  },
  playCircleLocked: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft,
    shadowOpacity: 0
  },
  workoutCopy: {
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  workoutTitle: {
    fontFamily: fontFamilies.display
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 6
  },
  rewardText: {
    flexShrink: 1,
    fontFamily: fontFamilies.terminal
  },
  timing: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  backButton: {
    marginTop: spacing.lg
  },
  emptyCard: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  emptyCopy: {
    fontFamily: fontFamilies.body
  },
  pressed: {
    ...interactionStates.pressed
  }
});
