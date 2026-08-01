import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AuthTextField } from '@/components/auth';
import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  TerminalText
} from '@/components/cyber';
import { RecoverableScreenError } from '@/components/reliability';
import {
  creatorFeaturePausedMessage,
  creatorFeatureStatusLabel,
  creatorFeaturesEnabled
} from '@/config/features';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { useCreatorWorkouts, usePlanCreatorWorkout } from '@/data/appDataHooks';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { useWorkoutVerificationPreference } from '@/hooks/useWorkoutVerificationPreference';
import { goBackOrReplace } from '@/navigation/goBack';
import { useCompetitionRegion } from '@/state/competitionRegion';

type RuleItem = {
  body: string;
};

const ruleItems: readonly RuleItem[] = [
  { body: 'Free to join. Your free prize-draw entry is secured immediately.' },
  {
    body: 'Creator features are based on GoGymGo selection and verified completions, not YouTube views.'
  },
  { body: 'GoGymGo controls stay outside the hosted video player.' },
  { body: 'Users earn entries only after heart-rate or QR verification.' }
];

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const { plannedDate: requestedPlannedDate, workoutId } = useLocalSearchParams<{
    plannedDate?: string;
    workoutId?: string;
  }>();
  const {
    data: creatorWorkouts = [],
    isError,
    isPending,
    refetch
  } = useCreatorWorkouts(regionVerification?.regionCode ?? '');
  const planCreatorWorkout = usePlanCreatorWorkout();
  const [plannedDate, setPlannedDate] = useState(() =>
    requestedPlannedDate && isFutureDateKey(requestedPlannedDate)
      ? requestedPlannedDate
      : nextDateKey()
  );
  const [planningFeedback, setPlanningFeedback] = useState<string | null>(null);
  const workout = creatorWorkouts.find((item) => item.id === workoutId);
  const {
    checking: setupChecking,
    error: setupError,
    ready: setupReady,
    retry: retrySetup,
    retrying: setupRetrying,
    setupActionLabel,
    setupRoute
  } = useSessionRegistrationAccess();
  const { ready: verificationPreferenceReady, workoutStartRoute } =
    useWorkoutVerificationPreference();

  if (!creatorFeaturesEnabled) {
    return (
      <ScreenContainer contentStyle={styles.unavailableScreen}>
        <HUDBorderBox glow style={styles.unavailableCard} tone="amber">
          <TerminalText glow tone="amber" variant="label">
            {creatorFeatureStatusLabel}
          </TerminalText>
          <TerminalText glow style={styles.unavailableTitle} tone="text" variant="title">
            CREATOR WORKOUTS
          </TerminalText>
          <TerminalText
            style={styles.unavailableBody}
            tone="muted"
            uppercase={false}
            variant="body"
          >
            {creatorFeaturePausedMessage}
          </TerminalText>
          <CyberButtonPrimary
            label="BACK TO CREATOR WORKOUTS"
            onPress={() => goBackOrReplace(router, '/workouts')}
            style={styles.unavailableAction}
          />
        </HUDBorderBox>
      </ScreenContainer>
    );
  }

  if (isPending || setupChecking || !verificationPreferenceReady) {
    return (
      <ScreenLoadingState
        body="Loading the creator workout and verification details."
        label="LOADING CREATOR WORKOUT"
      />
    );
  }

  if (setupError) {
    return (
      <RecoverableScreenError
        body="Your competition setup could not be checked. Retry before starting this workout."
        onRetry={() => void retrySetup()}
        retrying={setupRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }

  if (isError) {
    return (
      <ScreenContainer contentStyle={styles.unavailableScreen}>
        <HUDBorderBox glow style={styles.unavailableCard} tone="red">
          <TerminalText live="assertive" glow tone="red" variant="label">
            WORKOUT COULD NOT LOAD
          </TerminalText>
          <TerminalText
            style={styles.unavailableBody}
            tone="muted"
            uppercase={false}
            variant="body"
          >
            Check your connection and try loading this creator workout again.
          </TerminalText>
          <CyberButtonPrimary
            label="TRY AGAIN"
            onPress={() => void refetch()}
            style={styles.unavailableAction}
          />
        </HUDBorderBox>
      </ScreenContainer>
    );
  }

  if (!workout) {
    return (
      <ScreenContainer contentStyle={styles.unavailableScreen}>
        <HUDBorderBox glow style={styles.unavailableCard} tone="red">
          <TerminalText glow tone="red" variant="label">
            WORKOUT UNAVAILABLE
          </TerminalText>
          <TerminalText glow style={styles.unavailableTitle} tone="text" variant="title">
            WORKOUT NOT AVAILABLE
          </TerminalText>
          <TerminalText
            style={styles.unavailableBody}
            tone="muted"
            uppercase={false}
            variant="body"
          >
            This workout is not in the published catalog for your verified region. Return to the
            workout list for available sessions.
          </TerminalText>
          <CyberButtonPrimary
            label="BACK TO CREATOR WORKOUTS ->"
            onPress={() => goBackOrReplace(router, '/workouts')}
            style={styles.unavailableAction}
          />
        </HUDBorderBox>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/workouts')}
            style={styles.backButton}
          />
          <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
            CREATOR WORKOUT // {competitionRegion.label}
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.creatorHeader} tone="cyan">
          <View style={styles.creatorAvatar}>
            <TerminalText style={styles.creatorAvatarText} tone="dim" variant="button">
              {creatorInitials(workout.creatorName)}
            </TerminalText>
          </View>
          <View style={styles.creatorCopy}>
            <TerminalText style={styles.creatorTitle} tone="text" uppercase variant="body">
              {workout.name}
            </TerminalText>
            <TerminalText style={styles.metadataBody} tone="muted" variant="body">
              LED BY {workout.creatorName} · {workout.durationMinutes} MIN {workout.workoutStyle}
            </TerminalText>
          </View>
        </HUDBorderBox>

        <Pressable
          accessibilityLabel={`Play ${workout.name} by ${workout.creatorName}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(workout.videoUrl)}
          style={({ pressed }) => [styles.youtubeFrame, pressed ? styles.pressed : null]}
        >
          <View style={styles.youtubePlayer}>
            <View style={styles.youtubePlay}>
              <TerminalText glow tone="text" variant="micro">
                PLAY
              </TerminalText>
            </View>
            <View style={styles.channelRow}>
              <TerminalText style={styles.youtubeLogo} tone="pink" variant="micro">
                YOUTUBE
              </TerminalText>
              <TerminalText style={styles.channelText} tone="muted" variant="micro">
                GOGYMGO OFFICIAL CHANNEL
              </TerminalText>
            </View>
          </View>
        </Pressable>
        <TerminalText style={styles.youtubeFootnote} tone="dim" variant="micro">
          VIDEO PLAYS ON THE OFFICIAL GOGYMGO YOUTUBE CHANNEL.
        </TerminalText>

        <TerminalText style={styles.startHelper} tone="cyan" uppercase={false} variant="body">
          Start your verified GoGymGo session first, then play the video. The video alone does not
          count as a verified workout.
        </TerminalText>

        <CyberButtonPrimary
          label={setupReady ? 'START VERIFIED SESSION ->' : setupActionLabel}
          onPress={() => {
            const route = setupReady ? workoutStartRoute : setupRoute;
            if (route) {
              router.push(route as Href);
            }
          }}
          style={styles.startButton}
          tone="cyan"
        />

        <HUDBorderBox style={styles.planningCard} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            ADD TO WORKOUT CALENDAR
          </TerminalText>
          <TerminalText style={styles.planningCopy} tone="muted" uppercase={false} variant="body">
            Plan this creator video for a future day. Planning does not verify a workout or award
            entries.
          </TerminalText>
          <AuthTextField
            autoCapitalize="none"
            editable={!planCreatorWorkout.isPending}
            keyboardType="numbers-and-punctuation"
            label="PLANNED DATE // YYYY-MM-DD"
            maxLength={10}
            onChangeText={(value) => {
              setPlannedDate(value);
              setPlanningFeedback(null);
            }}
            placeholder={nextDateKey()}
            value={plannedDate}
          />
          {planningFeedback ? (
            <TerminalText
              live="polite"
              tone={planningFeedback.startsWith('PLANNED') ? 'green' : 'red'}
              uppercase={false}
              variant="caption"
            >
              {planningFeedback}
            </TerminalText>
          ) : null}
          <CyberButtonOutline
            disabled={planCreatorWorkout.isPending || !isFutureDateKey(plannedDate)}
            label={planCreatorWorkout.isPending ? 'ADDING...' : 'ADD TO CALENDAR ->'}
            onPress={() =>
              void planCreatorWorkout
                .mutateAsync({
                  plannedDate,
                  workoutId: workout.id
                })
                .then(() =>
                  setPlanningFeedback(
                    `PLANNED FOR ${plannedDate}. OPEN YOUR WORKOUT CALENDAR TO REVIEW IT.`
                  )
                )
                .catch(() =>
                  setPlanningFeedback(
                    'THIS WORKOUT COULD NOT BE ADDED. CHECK THE DATE AND TRY AGAIN.'
                  )
                )
            }
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.rulesCard} tone="muted">
          <TerminalText tone="dim" variant="label">
            ENTRY ELIGIBILITY
          </TerminalText>
          <View style={styles.rulesList}>
            {ruleItems.map((rule) => (
              <View key={rule.body} style={styles.ruleRow}>
                <TerminalText glow tone="cyan" variant="micro">
                  OK
                </TerminalText>
                <TerminalText style={styles.ruleText} tone="muted" uppercase={false} variant="body">
                  {rule.body}
                </TerminalText>
              </View>
            ))}
          </View>
          <CyberButtonOutline
            label="VIEW OFFICIAL CONTEST RULES"
            onPress={() => router.push('/official-rules')}
          />
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function nextDateKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isFutureDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const candidate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(candidate.getTime()) && candidate >= today;
}

function creatorInitials(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const styles = StyleSheet.create({
  unavailableScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenX,
    backgroundColor: colors.background
  },
  unavailableCard: {
    padding: spacing.xxl
  },
  unavailableTitle: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display
  },
  unavailableBody: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body
  },
  unavailableAction: {
    marginTop: spacing.xl
  },
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
    gap: spacing.md,
    marginBottom: spacing.md
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  creatorAvatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  creatorAvatarText: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  creatorCopy: {
    flex: 1
  },
  creatorTitle: {
    marginBottom: 2,
    fontFamily: fontFamilies.display
  },
  metadataBody: {
    fontFamily: fontFamilies.terminal
  },
  youtubeFrame: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.whiteAlpha10,
    borderRadius: radii.lg
  },
  youtubePlayer: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceVideoDark
  },
  youtubePlay: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: colors.statusError
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md
  },
  youtubeLogo: {
    color: colors.statusError,
    fontFamily: fontFamilies.display
  },
  channelText: {
    fontFamily: fontFamilies.terminal
  },
  youtubeFootnote: {
    marginTop: 7,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  pressableCard: {
    width: '100%'
  },
  verificationCard: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  verificationCopy: {
    marginTop: 7,
    fontFamily: fontFamilies.body
  },
  verificationList: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  verificationItemText: {
    flex: 1,
    fontFamily: fontFamilies.display
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: spacing.md
  },
  rewardCard: {
    flex: 1,
    padding: 14
  },
  rewardValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  rulesCard: {
    marginTop: spacing.md,
    padding: 15
  },
  rulesList: {
    gap: 9,
    marginTop: 10
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9
  },
  ruleText: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  startButton: {
    marginTop: 18
  },
  planningCard: {
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg
  },
  planningCopy: {
    fontFamily: fontFamilies.body
  },
  startHelper: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
