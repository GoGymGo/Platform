import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { RecoverableError } from '@/components/reliability';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import {
  creatorFeaturePausedMessage,
  creatorFeatureStatusLabel,
  creatorFeaturesEnabled
} from '@/config/features';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';
import { useCreatorWorkouts } from '@/data/appDataHooks';
import type { CreatorWorkout } from '@/domain/creatorWorkouts';
import { getCreatorWorkoutsReturnTarget } from '@/navigation/creatorWorkouts';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { plannedDate, source } = useLocalSearchParams<{
    plannedDate?: string;
    source?: string;
  }>();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const creatorWorkoutsQuery = useCreatorWorkouts(
    regionVerification?.regionCode ?? ''
  );
  const {
    data: creatorWorkouts = [],
    isPending: creatorWorkoutsPending
  } = creatorWorkoutsQuery;
  const returnTarget = getCreatorWorkoutsReturnTarget(source);

  if (!creatorFeaturesEnabled) {
    return (
      <ScreenContainer>
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          memoryKey="creator-workouts"
          showsVerticalScrollIndicator={false}
        >
          <BrandScreenHeader
            description="Follow-along sessions become competition progress only after a verified gym workout."
            eyebrow={`FOLLOW ALONG // ${competitionRegion.label}`}
            title="CREATOR WORKOUTS"
          />
          <HUDBorderBox style={styles.infoNote} tone="amber">
            <TerminalText style={styles.infoMark} tone="amber" variant="label">
              {creatorFeatureStatusLabel}
            </TerminalText>
            <TerminalText style={styles.infoCopy} tone="muted" uppercase={false} variant="body">
              {creatorFeaturePausedMessage}
            </TerminalText>
          </HUDBorderBox>
          <HUDBorderBox style={styles.creatorSubmitCard} tone="pink">
            <TerminalText tone="pink" variant="label">
              CREATOR STUDIO
            </TerminalText>
            <TerminalText style={styles.creatorSubmitCopy} tone="muted" uppercase={false} variant="body">
              Creator Studio is not available in this release.
            </TerminalText>
            <CyberButtonPrimary
              disabled
              label="CREATOR STUDIO UNAVAILABLE"
              onPress={() => undefined}
              tone="pink"
            />
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

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey="creator-workouts"
        showsVerticalScrollIndicator={false}
      >
        <BrandScreenHeader
          description="Choose a regional follow-along session, then verify the workout at an eligible gym."
          eyebrow={`FOLLOW ALONG // ${competitionRegion.label}`}
          title="CREATOR WORKOUTS"
        />

        <HUDBorderBox style={styles.infoNote} tone="cyan">
          <TerminalText style={styles.infoMark} tone="cyan" variant="label">
            INFO
          </TerminalText>
          <TerminalText style={styles.infoCopy} tone="cyan" uppercase={false} variant="body">
            Choose a regional follow-along workout, start a verified GoGymGo
            session, then play the video. Video views alone never earn entries.
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.workoutList}>
          {creatorWorkoutsQuery.isError ? (
            <RecoverableError
              body="The creator workout catalog could not be loaded. Retry to refresh the list."
              onRetry={() => {
                void recordFlowMetric(user?.uid, 'flow-retry', 'workouts');
                void creatorWorkoutsQuery.refetch();
              }}
              retrying={creatorWorkoutsQuery.isFetching}
              title="COULD NOT LOAD WORKOUTS"
            />
          ) : null}
          {creatorWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              plannedDate={plannedDate}
              workout={workout}
            />
          ))}
          {!creatorWorkoutsQuery.isError && !creatorWorkoutsPending && creatorWorkouts.length === 0 ? (
            <HUDBorderBox style={styles.emptyCard} tone="muted">
              <TerminalText glow tone="amber" variant="label">
                NO WORKOUTS PUBLISHED
              </TerminalText>
              <TerminalText style={styles.emptyCopy} tone="muted" variant="body">
                NO CREATOR WORKOUTS HAVE BEEN PUBLISHED FOR THIS REGION YET.
              </TerminalText>
            </HUDBorderBox>
          ) : null}
        </View>

        <HUDBorderBox style={styles.creatorSubmitCard} tone="pink">
          <TerminalText tone="pink" variant="label">
            CREATOR STUDIO
          </TerminalText>
          <TerminalText style={styles.creatorSubmitCopy} tone="muted" uppercase={false} variant="body">
            Approved creators can submit hosted workout videos for review, including brand and AI-assisted adaptation permissions.
          </TerminalText>
          <CyberButtonPrimary
            label="SUBMIT A CREATOR VIDEO"
            onPress={() => router.push('/creator/submit')}
            tone="pink"
          />
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
  plannedDate,
  workout
}: {
  plannedDate?: string;
  workout: CreatorWorkout;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel={`${workout.name} by ${workout.creatorName}. ${workout.durationMinutes} minute ${workout.workoutStyle} workout. Open workout.`}
      accessibilityRole="button"
      onPress={() => router.push(
        (plannedDate
          ? `/workouts/${workout.id}?plannedDate=${plannedDate}`
          : `/workouts/${workout.id}`) as Href
      )}
      style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
    >
      <HUDBorderBox style={styles.workoutCard} tone="cyan">
        <View style={[styles.workoutPreview, styles.workoutPreviewActive]}>
          <View style={styles.badgeRow}>
            <HUDBorderBox style={styles.creatorBadge} tone="cyan">
              <TerminalText tone="cyan" variant="micro">
                CREATOR
              </TerminalText>
            </HUDBorderBox>
            <HUDBorderBox style={styles.featuredBadge} tone="cyan">
              <TerminalText tone="cyan" variant="micro">
                FEATURED
              </TerminalText>
            </HUDBorderBox>
          </View>
          <View style={styles.playCircle}>
            <Ionicons
              color={colors.cyan}
              name="play"
              size={21}
            />
          </View>
          <TerminalText
            style={styles.previewStyle}
            tone="cyan"
            variant="micro"
          >
            {workout.workoutStyle}
          </TerminalText>
        </View>
        <View style={styles.workoutCopy}>
          <TerminalText style={styles.workoutTitle} tone="text" uppercase variant="body">
            {workout.name}
          </TerminalText>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons color={colors.muted} name="person-outline" size={14} />
              <TerminalText tone="muted" variant="caption">
                {workout.creatorName}
              </TerminalText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons color={colors.muted} name="time-outline" size={14} />
              <TerminalText tone="muted" variant="caption">
                {workout.durationMinutes} MIN
              </TerminalText>
            </View>
          </View>
          <TerminalText style={styles.catalogDetail} tone="muted" uppercase={false} variant="caption">
            {workout.reward}
          </TerminalText>
          <TerminalText style={styles.timing} tone="dim" variant="micro">
            {workout.timing}
          </TerminalText>
        </View>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: brandScreenStyles.tabContent,
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
  creatorSubmitCard: {
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  creatorSubmitCopy: {
    fontFamily: fontFamilies.body
  },
  workoutList: {
    gap: 13
  },
  pressableCard: {
    width: '100%'
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
  featuredBadge: {
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
    backgroundColor: colors.surfaceCyanProgress
  },
  previewStyle: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal,
    letterSpacing: 1.2
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
  metaItem: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelSoft
  },
  timing: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  catalogDetail: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
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
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
