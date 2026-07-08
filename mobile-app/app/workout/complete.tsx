import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { BrandVideoAdPlaceholder } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

const progressSlots = [true, false, false, false] as const;

export default function WorkoutCompleteScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <HUDBorderBox glow style={styles.badge} tone="cyan">
          <TerminalText glow style={styles.badgeText} tone="cyan" variant="display">
            +10
          </TerminalText>
        </HUDBorderBox>

        <TerminalText glow style={styles.eyebrow} tone="cyan" variant="label">
          SESSION VERIFIED OK
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          +10 ENTRIES BANKED
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          FIRST VERIFIED SESSION COMPLETE. YOUR WEEKLY PACT UNLOCKS AFTER YOU
          ARE MATCHED WITH SOMEONE ON A SIMILAR GOAL.
        </TerminalText>

        <BrandVideoAdPlaceholder
          compact
          eventLabel="VERIFIED WORKOUT FINISH"
          onPress={() => router.push('/sponsor-offer')}
          placementLabel="WORKOUT COMPLETE"
          style={styles.videoAd}
        />

        <HUDBorderBox style={styles.progressCard} tone="cyan">
          <View style={styles.progressHeader}>
            <TerminalText tone="muted" variant="label">
              WEEK 1 PROGRESS
            </TerminalText>
            <TerminalText glow tone="cyan" variant="label">
              1 / 4
            </TerminalText>
          </View>
          <View style={styles.progressBars}>
            {progressSlots.map((isComplete, index) => (
              <View
                key={`slot-${index + 1}`}
                style={[styles.progressBar, isComplete ? styles.progressBarDone : styles.progressBarOpen]}
              />
            ))}
          </View>
          <TerminalText style={styles.progressNote} tone="dim" variant="micro">
            COMPLETE 3 MORE VERIFIED SESSIONS TO HIT THIS WEEK'S GOAL.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="BACK TO HOME ->"
          onPress={() => router.push('/home')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.background
  },
  badge: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 65,
    marginBottom: 10,
    ...cyberGlow.cyan
  },
  badgeText: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displaySmall,
    lineHeight: 42
  },
  eyebrow: {
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  title: {
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 300,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  videoAd: {
    marginBottom: spacing.lg
  },
  progressCard: {
    width: '100%',
    marginBottom: spacing.xxl,
    padding: spacing.lg
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  progressBars: {
    flexDirection: 'row',
    gap: 6
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4
  },
  progressBarDone: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  progressBarOpen: {
    backgroundColor: colors.whiteAlpha08
  },
  progressNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  }
});
