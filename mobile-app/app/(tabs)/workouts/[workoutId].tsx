import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';

type RuleItem = {
  body: string;
};

const ruleItems: readonly RuleItem[] = [
  { body: 'FREE TO JOIN // STANDARD SIGNUP ENTRY APPLIES.' },
  {
    body: 'CREATOR PAYOUT IS BASED ON GOGYMGO SELECTION AND VERIFIED COMPLETIONS, NOT YOUTUBE VIEWS.'
  },
  { body: 'SPONSOR CREATIVE STAYS OUTSIDE THE YOUTUBE PLAYER.' },
  { body: 'USERS EARN ENTRIES ONLY AFTER HEART-RATE OR QR VERIFICATION.' }
];

export default function WorkoutDetailScreen() {
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
          <CyberButtonOutline
            label="BACK"
            onPress={() => router.back()}
            style={styles.backButton}
          />
          <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
            CREATOR WORKOUT // TORONTO
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.creatorHeader} tone="cyan">
          <View style={styles.creatorAvatar}>
            <TerminalText style={styles.creatorAvatarText} tone="dim" variant="button">
              AX
            </TerminalText>
          </View>
          <View style={styles.creatorCopy}>
            <TerminalText style={styles.creatorTitle} tone="text" uppercase variant="body">
              TORONTO CREATOR WORKOUT
            </TerminalText>
            <TerminalText tone="muted" variant="body">
              LED BY APEX ATHLETICS // OFFICIAL GOGYMGO CHANNEL
            </TerminalText>
          </View>
        </HUDBorderBox>

        <View style={styles.youtubeFrame}>
          <View style={styles.youtubePlayer}>
            <View style={styles.youtubePlay}>
              <TerminalText glow tone="text" variant="micro">
                PLAY
              </TerminalText>
            </View>
            <View style={styles.channelRow}>
              <TerminalText style={styles.youtubeLogo} tone="pink" variant="micro">
                YT
              </TerminalText>
              <TerminalText style={styles.channelText} tone="muted" variant="micro">
                GOGYMGO OFFICIAL CHANNEL
              </TerminalText>
            </View>
          </View>
        </View>
        <TerminalText style={styles.youtubeFootnote} tone="dim" variant="micro">
          YOUTUBE PLAYER // NO SPONSOR OVERLAYS // CONTROLS & ADS UNTOUCHED
        </TerminalText>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/sponsor-offer')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox style={styles.safeSponsorCard} tone="muted">
            <View style={styles.safeSponsorMark}>
              <TerminalText glow tone="pink" variant="title">
                V
              </TerminalText>
            </View>
            <View style={styles.safeSponsorCopy}>
              <TerminalText tone="dim" variant="micro">
                SPONSOR AREA // SAFE-ZONE
              </TerminalText>
              <TerminalText style={styles.safeSponsorTitle} tone="text" variant="body">
                VOLT ENERGY // TORONTO SPONSOR
              </TerminalText>
              <TerminalText tone="muted" variant="body">
                FUNDS PRIZE POOL + CREATOR PAYOUT
              </TerminalText>
            </View>
          </HUDBorderBox>
        </Pressable>

        <HUDBorderBox style={styles.selectionCard} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            CREATOR SELECTION
          </TerminalText>
          <TerminalText style={styles.selectionCopy} tone="muted" variant="body">
            LOCAL CREATORS SUBMIT MONTHLY FOLLOW-ALONG WORKOUTS. GOGYMGO
            SELECTS THE STRONGEST REGIONAL VIDEO FOR THE OFFICIAL CHANNEL, AND
            THE SELECTED CREATOR EARNS A SPONSOR-FUNDED PAYOUT.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.verificationCard} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            MVP VERIFICATION PLACEHOLDER
          </TerminalText>
          <TerminalText style={styles.verificationCopy} tone="muted" variant="body">
            CHECK-IN, MID-WORKOUT PING AND CHECKOUT WILL USE IOS FACE ID OR
            ANDROID BIOMETRICPROMPT THROUGH THE DEVICE OS. GOGYMGO RECEIVES
            CHECKPOINT RESULTS ONLY, NOT FACE SCANS OR BIOMETRIC DATA.
          </TerminalText>
          <View style={styles.verificationList}>
            <View style={styles.verificationItem}>
              <TerminalText glow tone="cyan" variant="micro">
                01
              </TerminalText>
              <TerminalText style={styles.verificationItemText} tone="muted" variant="micro">
                SERVER CHALLENGE
              </TerminalText>
            </View>
            <View style={styles.verificationItem}>
              <TerminalText glow tone="cyan" variant="micro">
                02
              </TerminalText>
              <TerminalText style={styles.verificationItemText} tone="muted" variant="micro">
                OS BIOMETRIC PROMPT
              </TerminalText>
            </View>
            <View style={styles.verificationItem}>
              <TerminalText glow tone="cyan" variant="micro">
                03
              </TerminalText>
              <TerminalText style={styles.verificationItemText} tone="muted" variant="micro">
                SIGNED CHECKPOINT EVENT
              </TerminalText>
            </View>
          </View>
        </HUDBorderBox>

        <View style={styles.rewardRow}>
          <HUDBorderBox style={styles.rewardCard} tone="cyan">
            <TerminalText tone="muted" variant="micro">
              USER REWARD
            </TerminalText>
            <TerminalText style={styles.rewardValue} tone="text" variant="body">
              PRIZE DRAW ENTRIES
            </TerminalText>
          </HUDBorderBox>
          <HUDBorderBox style={styles.rewardCard} tone="pink">
            <TerminalText tone="muted" variant="micro">
              CREATOR PAYOUT
            </TerminalText>
            <TerminalText glow style={styles.rewardValue} tone="pink" variant="body">
              $1,000 SPONSOR POOL
            </TerminalText>
          </HUDBorderBox>
        </View>

        <HUDBorderBox style={styles.rulesCard} tone="muted">
          <TerminalText tone="dim" variant="label">
            OFFICIAL RULES
          </TerminalText>
          <View style={styles.rulesList}>
            {ruleItems.map((rule) => (
              <View key={rule.body} style={styles.ruleRow}>
                <TerminalText glow tone="cyan" variant="micro">
                  OK
                </TerminalText>
                <TerminalText style={styles.ruleText} tone="muted" variant="body">
                  {rule.body}
                </TerminalText>
              </View>
            ))}
          </View>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="START VERIFIED SESSION ->"
          onPress={() => router.push('/workout/check-in')}
          style={styles.startButton}
          tone="pink"
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  backButton: {
    width: 96,
    minHeight: 40,
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
  safeSponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  safeSponsorMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: radii.md,
    backgroundColor: colors.surfacePinkSoft
  },
  safeSponsorCopy: {
    flex: 1
  },
  safeSponsorTitle: {
    marginVertical: spacing.xs,
    fontFamily: fontFamilies.display
  },
  selectionCard: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  selectionCopy: {
    marginTop: 7,
    fontFamily: fontFamilies.terminal
  },
  verificationCard: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  verificationCopy: {
    marginTop: 7,
    fontFamily: fontFamilies.terminal
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
    fontFamily: fontFamilies.terminal
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
    fontFamily: fontFamilies.terminal
  },
  startButton: {
    marginTop: 18
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
