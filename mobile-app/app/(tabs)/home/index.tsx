import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BrandVideoAdPlaceholder } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

type HomeStat = {
  label: string;
  tone: 'cyan' | 'text';
  value: string;
};

const weeklyGoal = 4;
const completedSessions = 0;

const stats: readonly HomeStat[] = [
  { value: '1', label: 'CURRENT ENTRY', tone: 'text' },
  { value: '0', label: 'THIS WEEK', tone: 'cyan' },
  { value: '--', label: 'REGION RANK', tone: 'cyan' }
];

export default function HomeScreen() {
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
          <View style={styles.headerCopy}>
            <TerminalText glow tone="cyan" variant="label">
              ACCOUNT READY // TORONTO
            </TerminalText>
            <TerminalText glow style={styles.username} tone="cyan" variant="title">
              GHOST_RUNNER
            </TerminalText>
          </View>
          <View style={styles.avatar}>
            <TerminalText glow tone="cyan" variant="button">
              GR
            </TerminalText>
            <View style={styles.avatarDot} />
          </View>
        </View>

        <BrandVideoAdPlaceholder
          eventLabel="SIGNED-IN APP OPEN"
          onPress={() => router.push('/sponsor-offer')}
          placementLabel="APP OPEN"
          style={styles.videoAd}
        />

        <HUDBorderBox glow style={styles.commitmentCard} tone="cyan">
          <View style={styles.commitmentHeader}>
            <View style={styles.commitmentTitleBlock}>
              <TerminalText glow tone="cyan" variant="label">
                FIRST WEEK // READY
              </TerminalText>
              <TerminalText style={styles.commitmentTitle} tone="text" uppercase variant="title">
                START YOUR FIRST SESSION
              </TerminalText>
              <TerminalText style={styles.commitmentCopy} tone="muted" variant="body">
                COMPLETE A VERIFIED 30-MINUTE WORKOUT TO ADD ENTRIES AND UNLOCK
                YOUR FIRST WEEKLY PACT.
              </TerminalText>
            </View>
            <View style={styles.multiplierBlock}>
              <TerminalText glow style={styles.multiplier} tone="cyan" variant="value">
                1X
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                BASE
              </TerminalText>
            </View>
          </View>

          <View style={styles.weekDots}>
            {Array.from({ length: weeklyGoal }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.weekDot,
                  index < completedSessions ? styles.weekDotDone : styles.weekDotOpen
                ]}
              />
            ))}
          </View>

          <CyberButtonPrimary
            label="START 30-MIN SESSION"
            onPress={() => router.push('/workout/check-in')}
          />
        </HUDBorderBox>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <HUDBorderBox key={stat.label} style={styles.statCard} tone="muted">
              <TerminalText
                glow={stat.tone !== 'text'}
                style={styles.statValue}
                tone={stat.tone}
                variant="value"
              >
                {stat.value}
              </TerminalText>
              <TerminalText style={styles.statLabel} tone="muted" variant="micro">
                {stat.label}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>
        <TerminalText style={styles.oddsNote} tone="muted" variant="body">
          YOUR SIGNUP ENTRY IS ACTIVE. VERIFIED WORKOUTS ADD MORE ENTRIES.
        </TerminalText>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/squad')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox style={styles.pactCard} tone="cyan">
            <View style={styles.pactAvatars}>
              <View style={styles.pactAvatarYou}>
                <TerminalText style={styles.pactAvatarTextDark} tone="dim" variant="button">
                  GR
                </TerminalText>
              </View>
              <View style={styles.pactAvatarMatch}>
                <TerminalText glow tone="text" variant="button">
                  JX
                </TerminalText>
              </View>
            </View>
            <View style={styles.pactCopy}>
              <TerminalText glow tone="cyan" variant="micro">
                WEEKLY PACT
              </TerminalText>
              <TerminalText style={styles.pactTitle} tone="text" uppercase variant="body">
                UNLOCKS AFTER YOUR FIRST SESSION
              </TerminalText>
            </View>
            <TerminalText tone="cyan" variant="button">
              -&gt;
            </TerminalText>
          </HUDBorderBox>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/workouts/toronto-creator-workout')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox style={styles.workoutCard} tone="pink">
            <View style={styles.videoPreview}>
              <View style={styles.videoBadgeRow}>
                <View style={styles.creatorBadge}>
                  <TerminalText glow tone="pink" variant="micro">
                    CREATOR WORKOUT
                  </TerminalText>
                </View>
                <View style={styles.channelBadge}>
                  <TerminalText glow tone="cyan" variant="micro">
                    OFFICIAL CHANNEL
                  </TerminalText>
                </View>
              </View>
              <View style={styles.playCircle}>
                <TerminalText glow tone="pink" variant="micro">
                  PLAY
                </TerminalText>
              </View>
            </View>
            <View style={styles.workoutCopy}>
              <TerminalText style={styles.workoutTitle} tone="text" uppercase variant="body">
                TORONTO CREATOR WORKOUT
              </TerminalText>
              <TerminalText tone="muted" variant="body">
                OPTIONAL FOLLOW-ALONG WORKOUT // VERIFIED IN GOGYMGO
              </TerminalText>
            </View>
          </HUDBorderBox>
        </Pressable>

        <CyberButtonOutline
          label="VIEW CREATOR WORKOUTS ->"
          onPress={() => router.push('/workouts')}
          style={styles.workoutsButton}
          tone="cyan"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function SponsorBanner() {
  return (
    <HUDBorderBox style={styles.topSponsorBanner} tone="muted">
      <View style={styles.topSponsorMark}>
        <TerminalText glow tone="pink" variant="title">
          V
        </TerminalText>
      </View>
      <View style={styles.topSponsorCopy}>
        <TerminalText tone="dim" variant="micro">
          SPONSOR SIGNAL
        </TerminalText>
        <TerminalText style={styles.topSponsorTitle} tone="text" variant="body">
          SPONSORED BY VOLT
        </TerminalText>
        <TerminalText tone="muted" variant="body">
          PRIZE POOL PARTNER
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  topSponsorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  topSponsorMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 8,
    backgroundColor: colors.surfacePinkSoft
  },
  topSponsorCopy: {
    flex: 1
  },
  topSponsorTitle: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md
  },
  username: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanProminent,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceCyanProgress,
    ...cyberGlow.cyan
  },
  avatarDot: {
    width: 9,
    height: 9,
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 5,
    backgroundColor: colors.pink,
    alignSelf: 'flex-end',
    marginTop: -8,
    marginRight: -2
  },
  pressableCard: {
    width: '100%'
  },
  videoAd: {
    marginBottom: spacing.lg,
  },
  commitmentCard: {
    marginBottom: spacing.lg,
    padding: spacing.xl
  },
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  commitmentTitleBlock: {
    flex: 1
  },
  commitmentTitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 25
  },
  commitmentCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  multiplierBlock: {
    alignItems: 'flex-end'
  },
  multiplier: {
    fontFamily: fontFamilies.display
  },
  weekDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.lg
  },
  weekDot: {
    flex: 1,
    height: 8,
    borderRadius: 4
  },
  weekDotDone: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  weekDotOpen: {
    backgroundColor: colors.whiteAlpha08
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm
  },
  statCard: {
    flex: 1,
    minHeight: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: spacing.md
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 28
  },
  statLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  oddsNote: {
    marginBottom: spacing.md,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  pactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  pactAvatars: {
    flexDirection: 'row'
  },
  pactAvatarYou: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.cyan
  },
  pactAvatarMatch: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: radii.md,
    backgroundColor: colors.pink,
    marginLeft: -10
  },
  pactAvatarTextDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  pactCopy: {
    flex: 1
  },
  pactTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.terminal
  },
  workoutCard: {
    overflow: 'hidden',
    padding: 0,
    marginBottom: spacing.md
  },
  videoPreview: {
    minHeight: 112,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfacePrizeDark
  },
  videoBadgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  creatorBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderPink,
    borderRadius: 5
  },
  channelBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 5
  },
  playCircle: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderPinkHeavy,
    borderRadius: 25,
    backgroundColor: colors.surfacePinkStrong,
    ...cyberGlow.pink
  },
  workoutCopy: {
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  workoutTitle: {
    marginBottom: 3,
    fontFamily: fontFamilies.display
  },
  workoutsButton: {
    marginTop: 0
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
