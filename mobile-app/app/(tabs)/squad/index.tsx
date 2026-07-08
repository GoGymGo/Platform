import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';

type PlayerTone = 'cyan' | 'pink';

export default function SquadScreen() {
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
            WEEKLY PACT
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            UNLOCK YOUR FIRST MATCH
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.pactCard} tone="cyan">
          <View style={styles.matchupRow}>
            <PlayerBlock initials="GR" label="YOU" progress="0 / 4" tone="cyan" />
            <TerminalText style={styles.vsText} tone="dim" variant="button">
              VS
            </TerminalText>
            <PlayerBlock initials="--" label="MATCH SOON" progress="LOCKED" tone="pink" />
          </View>
          <HUDBorderBox style={styles.matchNote} tone="cyan">
            <TerminalText style={styles.matchNoteText} tone="cyan" variant="body">
              COMPLETE YOUR FIRST VERIFIED SESSION TO JOIN A WEEKLY MATCH WITH
              SOMEONE ON A SIMILAR GOAL.
            </TerminalText>
          </HUDBorderBox>
        </HUDBorderBox>

        <HUDBorderBox glow style={styles.forfeitCard} tone="pink">
          <View style={styles.forfeitHeader}>
            <TerminalText glow tone="pink" variant="micro">
              BONUS
            </TerminalText>
            <TerminalText glow tone="pink" variant="label">
              MAKE-UP BONUS
            </TerminalText>
          </View>
          <TerminalText style={styles.forfeitCopy} tone="text" uppercase variant="body">
            AFTER YOU ARE MATCHED, BOTH HIT THE GOAL FOR 2X. IF YOUR MATCH
            MISSES, COMPLETE ONE EXTRA VERIFIED WORKOUT TO EARN 3X.
          </TerminalText>
          <View style={styles.claimRow}>
            <TerminalText tone="muted" variant="micro">
              STATUS
            </TerminalText>
            <TerminalText glow style={styles.claimValue} tone="pink" variant="body">
              LOCKED UNTIL MATCHED
            </TerminalText>
          </View>
        </HUDBorderBox>

        <HUDBorderBox style={styles.chatCard} tone="muted">
          <View style={styles.chatHeader}>
            <TerminalText tone="muted" variant="label">
              PACT CHAT
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              OPENS AFTER MATCH
            </TerminalText>
          </View>
          <HUDBorderBox style={styles.emptyChatCard} tone="muted">
            <TerminalText style={styles.emptyChatText} tone="muted" variant="body">
              YOUR FIRST MATCH AND CHAT OPEN AFTER A VERIFIED WORKOUT.
            </TerminalText>
          </HUDBorderBox>
        </HUDBorderBox>

        <CyberButtonOutline
          label="VIEW GYM COMPETITION ->"
          onPress={() => router.push('/squad/gym')}
          style={styles.gymButton}
        />
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

function PlayerBlock({
  initials,
  label,
  progress,
  tone
}: {
  initials: string;
  label: string;
  progress: string;
  tone: PlayerTone;
}) {
  const isPink = tone === 'pink';

  return (
    <View style={styles.playerBlock}>
      <View style={[styles.playerAvatar, isPink ? styles.playerAvatarPink : styles.playerAvatarCyan]}>
        <TerminalText style={isPink ? styles.playerInitialsLight : styles.playerInitialsDark} tone="text" variant="button">
          {initials}
        </TerminalText>
      </View>
      <TerminalText style={styles.playerLabel} tone="text" variant="body">
        {label}
      </TerminalText>
      <TerminalText glow style={styles.playerProgress} tone={tone} variant="micro">
        {progress}
      </TerminalText>
    </View>
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
  pactCard: {
    marginBottom: spacing.lg,
    padding: 18
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  playerBlock: {
    flex: 1,
    alignItems: 'center'
  },
  playerAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14
  },
  playerAvatarCyan: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  playerAvatarPink: {
    backgroundColor: colors.pink,
    ...cyberGlow.pink
  },
  playerInitialsDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  playerInitialsLight: {
    color: colors.text,
    fontFamily: fontFamilies.display
  },
  playerLabel: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  playerProgress: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  vsText: {
    fontFamily: fontFamilies.display
  },
  matchNote: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 14
  },
  matchNoteText: {
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  forfeitCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  forfeitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  forfeitCopy: {
    fontFamily: fontFamilies.terminal
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 13
  },
  claimValue: {
    fontFamily: fontFamilies.display,
    textAlign: 'right'
  },
  chatCard: {
    overflow: 'hidden',
    padding: spacing.md
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  emptyChatCard: {
    padding: spacing.md
  },
  emptyChatText: {
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  gymButton: {
    marginTop: spacing.lg
  },
  backButton: {
    marginTop: spacing.md
  }
});
