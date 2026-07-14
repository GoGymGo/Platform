import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, componentSizes, fontFamilies, interactionStates, spacing, fontSizes } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';

export default function GymCompetitionScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/squad')}
            style={styles.backButton}
          />
          <View style={styles.headerCopy}>
            <TerminalText tone="dim" variant="label">
              PARTNER GYM
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
              SCAN THE ENTRY QR WHEN YOU ARRIVE AND THE EXIT QR WHEN YOU LEAVE.
              BOTH SCANS ARE REQUIRED TO VERIFY THE SESSION.
            </TerminalText>
            <HUDBorderBox glow style={styles.qrBox} tone="cyan">
              <TerminalText glow style={styles.qrText} tone="cyan" variant="display">
                QR
              </TerminalText>
              <TerminalText tone="dim" variant="micro">
                ENTRY + EXIT
              </TerminalText>
            </HUDBorderBox>
            <TerminalText style={styles.scanAction} glow tone="cyan" variant="button">
              OPEN QR SCANNER -&gt;
            </TerminalText>
          </HUDBorderBox>
        </Pressable>

        <HUDBorderBox style={styles.communityCard} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            GYM COMMUNITY
          </TerminalText>
          <View style={styles.communityMetrics}>
            <View style={styles.communityMetric}>
              <TerminalText glow tone="cyan" variant="value">
                38
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                ACTIVE MEMBERS
              </TerminalText>
            </View>
            <View style={styles.communityDivider} />
            <View style={styles.communityMetric}>
              <TerminalText glow tone="cyan" variant="value">
                0
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                YOUR VERIFIED SESSIONS
              </TerminalText>
            </View>
          </View>
          <TerminalText tone="dim" variant="caption">
            VERIFIED GYM SESSIONS COUNT TOWARD YOUR REGIONAL COMPETITION GOAL.
          </TerminalText>
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  backButton: {
    width: 96,
    minHeight: 44,
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
    width: '100%',
    ...interactionStates.webFocus
  },
  checkInCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.xl
  },
  checkInCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
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
  scanAction: {
    marginTop: spacing.md,
    textAlign: 'center'
  },
  communityCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  communityMetrics: {
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  communityMetric: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs
  },
  communityDivider: {
    width: 1,
    marginHorizontal: spacing.md,
    backgroundColor: colors.borderMuted
  },
  pressed: {
    ...interactionStates.pressed
  }
});
