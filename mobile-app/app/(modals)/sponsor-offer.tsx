import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';

const sponsorFacts = [
  "FUNDS THIS MONTH'S $5,000 REGIONAL PRIZE POOL",
  'SUPPORTS THE TORONTO CREATOR PAYOUT POOL',
  'OFFER LIVES OUTSIDE YOUTUBE PLAYER SURFACES'
] as const;

export default function SponsorOfferModal() {
  const router = useRouter();
  const [offerSaved, setOfferSaved] = useState(false);

  return (
    <ScreenContainer contentStyle={styles.sheet}>
      <View style={styles.header}>
        <TerminalText glow tone="pink" variant="label">
          SPONSOR OFFER
        </TerminalText>
        <CyberButtonOutline
          label="CLOSE"
          onPress={() => router.back()}
          style={styles.closeButton}
        />
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HUDBorderBox glow style={styles.heroCard} tone="pink">
          <View style={styles.logoMark}>
            <TerminalText glow style={styles.logoText} tone="pink" variant="display">
              V
            </TerminalText>
          </View>
          <TerminalText style={styles.sponsorName} tone="text" variant="title">
            VOLT ENERGY
          </TerminalText>
          <TerminalText tone="muted" variant="body">
            MONTHLY SPONSOR // TORONTO
          </TerminalText>
          <TerminalText glow style={styles.offerTitle} tone="pink" variant="body">
            15% OFF RECOVERY FUEL
          </TerminalText>
          <TerminalText glow style={styles.offerCode} tone="cyan" variant="label">
            CODE: GOGYMGO15
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.factList}>
          {sponsorFacts.map((fact) => (
            <HUDBorderBox key={fact} style={styles.factRow} tone="cyan">
              <TerminalText glow tone="cyan" variant="micro">
                OK
              </TerminalText>
              <TerminalText style={styles.factText} tone="cyan" variant="body">
                {fact}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>

        <HUDBorderBox style={styles.disclosureCard} tone="muted">
          <TerminalText tone="dim" variant="label">
            SPONSOR DISCLOSURE
          </TerminalText>
          <TerminalText style={styles.disclosureCopy} tone="muted" variant="body">
            SPONSOR PLACEMENTS CAN APPEAR IN GOGYMGO-OWNED APP SURFACES.
            YOUTUBE PLAYER CONTROLS AND ADS STAY UNTOUCHED.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          label="CLAIM OFFER ->"
          onPress={() => setOfferSaved(true)}
          style={styles.primaryButton}
          tone="pink"
        />

        {offerSaved ? (
          <HUDBorderBox glow style={styles.savedCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              OFFER SAVED
            </TerminalText>
            <TerminalText style={styles.savedCopy} tone="muted" variant="body">
              VOLT OFFER SAVED FOR YOUR GOGYMGO ACCOUNT.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <CyberButtonOutline
          label="BACK TO APP"
          onPress={() => router.back()}
          style={styles.secondaryButton}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteAlpha07
  },
  closeButton: {
    width: 104,
    minHeight: 40,
    paddingVertical: spacing.sm
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl
  },
  heroCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.xxl
  },
  logoMark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 20,
    backgroundColor: colors.surfacePink,
    marginBottom: spacing.md,
    ...cyberGlow.pink
  },
  logoText: {
    fontFamily: fontFamilies.display
  },
  sponsorName: {
    fontFamily: fontFamilies.display
  },
  offerTitle: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  offerCode: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  factList: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md
  },
  factText: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  disclosureCard: {
    marginBottom: spacing.xl,
    borderStyle: 'dashed'
  },
  disclosureCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  primaryButton: {
    marginBottom: spacing.sm
  },
  savedCard: {
    marginBottom: spacing.sm
  },
  savedCopy: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  secondaryButton: {
    marginTop: 0
  }
});
