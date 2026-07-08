import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';

type WorkoutRow = {
  id: string;
  joined: boolean;
  name: string;
  reward: string;
  sponsor: string;
  timing: string;
};

const workoutRows: readonly WorkoutRow[] = [
  {
    id: 'toronto-creator-workout',
    name: 'TORONTO CREATOR WORKOUT',
    sponsor: 'VOLT ENERGY',
    reward: '30 MIN HIIT // CREATOR PAYOUT + USER ENTRIES',
    timing: 'FEATURED NOW',
    joined: true
  },
  {
    id: 'july-creator-submissions',
    name: 'JULY CREATOR SUBMISSIONS',
    sponsor: 'STRIDELAB',
    reward: 'LOCAL VIDEOS UNDER REVIEW',
    timing: '6 DAYS TO SUBMIT',
    joined: false
  },
  {
    id: 'next-month-strength-slot',
    name: 'NEXT MONTH STRENGTH SLOT',
    sponsor: 'PEAKFUEL',
    reward: 'SELECTED CREATOR EARNS SPONSOR POOL',
    timing: 'OPENS JUL 1',
    joined: false
  }
];

export default function WorkoutsScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            CREATOR WORKOUTS
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            CREATOR WORKOUTS
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.infoNote} tone="cyan">
          <TerminalText glow style={styles.infoMark} tone="cyan" variant="label">
            INFO
          </TerminalText>
          <TerminalText style={styles.infoCopy} tone="cyan" variant="body">
            FOLLOW THE SELECTED LOCAL CREATOR WORKOUT ON THE OFFICIAL GOGYMGO
            YOUTUBE CHANNEL. USERS EARN FROM VERIFIED WORKOUTS, NOT YOUTUBE
            VIEWS.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.sponsorCard} tone="muted">
          <View style={styles.sponsorCardMark}>
            <TerminalText glow tone="pink" variant="title">
              V
            </TerminalText>
          </View>
          <View style={styles.sponsorCardCopy}>
            <TerminalText tone="dim" variant="micro">
              SPONSOR AREA // CREATOR LIST
            </TerminalText>
            <TerminalText style={styles.sponsorCardTitle} tone="text" variant="body">
              CREATOR PAYOUT POOL: $1,000
            </TerminalText>
            <TerminalText tone="muted" variant="body">
              PAID TO THE SELECTED TORONTO WORKOUT LEADER FROM SPONSOR
              CONTRIBUTION
            </TerminalText>
          </View>
        </HUDBorderBox>

        <View style={styles.workoutList}>
          {workoutRows.map((workout) => (
            <WorkoutCard key={workout.id} workout={workout} />
          ))}
        </View>

        <CyberButtonOutline
          label="BACK"
          onPress={() => router.push('/home')}
          style={styles.backButton}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function SponsorBanner() {
  return (
    <HUDBorderBox style={styles.sponsorBanner} tone="muted">
      <View style={styles.sponsorMark}>
        <TerminalText glow tone="pink" variant="title">
          V
        </TerminalText>
      </View>
      <View style={styles.sponsorCopy}>
        <TerminalText tone="dim" variant="micro">
          SPONSOR SIGNAL
        </TerminalText>
        <TerminalText style={styles.sponsorTitle} tone="text" variant="body">
          SPONSORED BY VOLT
        </TerminalText>
        <TerminalText tone="muted" variant="body">
          PRIZE POOL PARTNER
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

function WorkoutCard({ workout }: { workout: WorkoutRow }) {
  const router = useRouter();
  const badgeTone = workout.joined ? 'cyan' : 'muted';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/workouts/${workout.id}`)}
      style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
    >
      <HUDBorderBox glow={workout.joined} style={styles.workoutCard} tone={workout.joined ? 'pink' : 'muted'}>
        <View style={styles.workoutPreview}>
          <View style={styles.badgeRow}>
            <HUDBorderBox style={styles.creatorBadge} tone="pink">
              <TerminalText glow tone="pink" variant="micro">
                CREATOR
              </TerminalText>
            </HUDBorderBox>
            <HUDBorderBox style={styles.joinedBadge} tone={badgeTone}>
              <TerminalText glow={workout.joined} tone={workout.joined ? 'cyan' : 'muted'} variant="micro">
                {workout.joined ? 'JOINED' : 'JOIN'}
              </TerminalText>
            </HUDBorderBox>
          </View>
          <View style={styles.playCircle}>
            <TerminalText glow tone="pink" variant="micro">
              PLAY
            </TerminalText>
          </View>
        </View>
        <View style={styles.workoutCopy}>
          <TerminalText style={styles.workoutTitle} tone="text" uppercase variant="body">
            {workout.name}
          </TerminalText>
          <View style={styles.metaRow}>
            <TerminalText glow tone="pink" variant="micro">
              {workout.sponsor}
            </TerminalText>
            <TerminalText tone="cyan" variant="micro">
              //
            </TerminalText>
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
  sponsorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  sponsorMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 8,
    backgroundColor: colors.surfacePinkSoft
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
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
    fontFamily: fontFamilies.terminal
  },
  sponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
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
    padding: spacing.md,
    backgroundColor: colors.surfacePrizeDark
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
    borderColor: colors.borderPinkHeavy,
    borderRadius: 23,
    backgroundColor: colors.surfacePinkActive,
    ...cyberGlow.pink
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
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
