import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

type GymTone = 'pink' | 'cyan' | 'you';

type GymLeaderboardRow = {
  entries: string;
  initials: string;
  name: string;
  rank: string;
  tone: GymTone;
};

const gymRows: readonly GymLeaderboardRow[] = [
  { rank: '01', initials: 'DK', name: 'DEADLIFTKING', entries: '2,140', tone: 'pink' },
  { rank: '02', initials: 'SQ', name: 'SQUATSIREN', entries: '1,990', tone: 'cyan' },
  { rank: '--', initials: 'GR', name: 'GHOST_RUNNER // YOU', entries: 'NO GYM SESSION YET', tone: 'you' }
];

export default function GymCompetitionScreen() {
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
          <View style={styles.headerCopy}>
            <TerminalText tone="dim" variant="label">
              GYM COMPETITION
            </TerminalText>
            <TerminalText glow style={styles.headerTitle} tone="cyan" variant="title">
              IRON DISTRICT // KING ST
            </TerminalText>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/qr-scanner')}
          style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
        >
          <HUDBorderBox glow style={styles.checkInCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              VERIFY GYM PRESENCE
            </TerminalText>
            <TerminalText style={styles.checkInCopy} tone="muted" variant="body">
              SCAN A PARTNER-GYM ENTRY QR TO START YOUR FIRST GYM-VERIFIED
              SESSION.
            </TerminalText>
            <HUDBorderBox glow style={styles.qrBox} tone="cyan">
              <TerminalText glow style={styles.qrText} tone="cyan" variant="display">
                QR
              </TerminalText>
              <TerminalText tone="dim" variant="micro">
                ENTRY + EXIT
              </TerminalText>
            </HUDBorderBox>
            <View style={styles.verificationModes}>
              <HUDBorderBox style={styles.modeCard} tone="cyan">
                <TerminalText glow tone="cyan" variant="micro">
                  SCAN QR
                </TerminalText>
              </HUDBorderBox>
              <HUDBorderBox style={styles.modeCard} tone="muted">
                <TerminalText tone="muted" variant="micro">
                  PHONE BEACON
                </TerminalText>
              </HUDBorderBox>
            </View>
            <TerminalText style={styles.signedLine} tone="dim" variant="micro">
              SIGNED // TIME-BOUND // ENTRY + EXIT REQUIRED
            </TerminalText>
          </HUDBorderBox>
        </Pressable>

        <TerminalText style={styles.leaderboardLabel} tone="dim" variant="label">
          GYM LEADERBOARD // 38 MEMBERS
        </TerminalText>
        <View style={styles.rowList}>
          {gymRows.map((row) => (
            <GymResultRow key={row.rank} row={row} />
          ))}
        </View>
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

function GymResultRow({ row }: { row: GymLeaderboardRow }) {
  const rowTone = row.tone === 'you' ? 'cyan' : row.tone;
  const avatarStyle = row.tone === 'pink' ? styles.avatarPink : styles.avatarCyan;
  const avatarTextStyle = row.tone === 'pink' ? styles.avatarTextLight : styles.avatarTextDark;

  return (
    <HUDBorderBox glow={row.tone === 'you'} style={styles.resultRow} tone={rowTone}>
      <TerminalText glow={row.tone !== 'you'} style={styles.rankText} tone={rowTone} variant="label">
        {row.rank}
      </TerminalText>
      <View style={[styles.rowAvatar, avatarStyle]}>
        <TerminalText style={avatarTextStyle} tone="text" variant="button">
          {row.initials}
        </TerminalText>
      </View>
      <TerminalText style={styles.rowName} tone="text" uppercase variant="body">
        {row.name}
      </TerminalText>
      <TerminalText glow style={styles.rowEntries} tone="cyan" variant="body">
        {row.entries}
      </TerminalText>
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
    marginBottom: spacing.lg
  },
  backButton: {
    width: 96,
    minHeight: 40,
    paddingVertical: spacing.sm
  },
  headerCopy: {
    flex: 1
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  pressableCard: {
    width: '100%'
  },
  checkInCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.xl
  },
  checkInCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  qrBox: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 14,
    padding: 0,
    borderRadius: 18
  },
  qrText: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.qr,
    lineHeight: 52
  },
  verificationModes: {
    width: '100%',
    flexDirection: 'row',
    gap: 9
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    padding: 11,
    borderRadius: radii.md
  },
  signedLine: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  leaderboardLabel: {
    marginHorizontal: spacing.xs,
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  rowList: {
    gap: 9
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 14
  },
  rankText: {
    width: 26,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  rowAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  avatarPink: {
    backgroundColor: colors.pink,
    ...cyberGlow.pink
  },
  avatarCyan: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  avatarTextLight: {
    color: colors.text,
    fontFamily: fontFamilies.display
  },
  avatarTextDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  rowName: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  rowEntries: {
    fontFamily: fontFamilies.display
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
