import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SponsorRail } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import {
  formatCampaignCurrency,
  useSponsorCampaign
} from '@/state/sponsorCampaign';

type Accent = 'cyan';

type WelcomeStep = {
  accent: Accent;
  index: string;
  title: string;
};

const welcomeSteps: readonly WelcomeStep[] = [
  {
    accent: 'cyan',
    index: '01',
    title: 'SHOW UP'
  },
  {
    accent: 'cyan',
    index: '02',
    title: 'PROVE IT'
  },
  {
    accent: 'cyan',
    index: '03',
    title: 'WIN'
  }
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { campaign, economics } = useSponsorCampaign();
  const sponsorConfirmed = campaign.status === 'approved';

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SponsorRail style={styles.sponsorBanner} />

        <View style={styles.introStack}>
          <View style={styles.statusRail}>
            <View style={styles.onlineDot} />
            <TerminalText glow tone="cyan" variant="label">
              SYSTEM ONLINE // REGISTRATION OPEN
            </TerminalText>
          </View>

          <View style={styles.logoShell}>
            <View style={styles.logoRow}>
              <TerminalText glow style={styles.logoWord} tone="cyan" variant="display">
                GO
              </TerminalText>
              <TerminalText glow style={styles.logoWord} tone="pink" variant="display">
                GYM
              </TerminalText>
              <TerminalText glow style={styles.logoWord} tone="cyan" variant="display">
                GO
              </TerminalText>
            </View>
          </View>

          <HUDBorderBox style={styles.stepStrip} tone="cyan">
            {welcomeSteps.map((step) => (
              <WelcomeStepCell key={step.index} step={step} />
            ))}
          </HUDBorderBox>

          <TerminalText style={styles.sponsorLine} tone="dim" variant="label">
            FREE TO PLAY // FUNDED BY SPONSORS
          </TerminalText>

          <HUDBorderBox glow style={styles.entryPanel} tone="cyan">
            <TerminalText style={styles.entryIntro} tone="muted" variant="label">
              ON SIGNUP YOU RECEIVE A
            </TerminalText>
            <TerminalText glow style={styles.entryTitle} tone="pink" variant="value">
              FREE ENTRY
            </TerminalText>
            <TerminalText style={styles.entryActivation} tone="muted" variant="micro">
              INTO THE MONTHLY PRIZE DRAW
            </TerminalText>
            <View style={styles.entryDetailRow}>
              <View style={[styles.prizeBlock, !sponsorConfirmed && styles.pendingPrizeBlock]}>
                <TerminalText tone="muted" variant="micro">
                  PROJECTED DRAW POOL
                </TerminalText>
                <TerminalText
                  glow
                  style={[styles.prizeValue, !sponsorConfirmed && styles.prizePending]}
                  tone={sponsorConfirmed ? 'pink' : 'amber'}
                  variant="title"
                >
                  {sponsorConfirmed
                    ? formatCampaignCurrency(economics.prizeDrawAmount)
                    : 'PUBLISHED\nSOON'}
                </TerminalText>
              </View>
              <View style={[styles.sponsorAd, !sponsorConfirmed && styles.pendingSponsorAd]}>
                <View style={styles.sponsorAdCopy}>
                  <TerminalText tone="dim" variant="micro">
                    MONTH SPONSOR
                  </TerminalText>
                  <TerminalText style={styles.sponsorAdTitle} tone="text" variant="body">
                    {campaign.sponsor.offerTitle}
                  </TerminalText>
                </View>
              </View>
            </View>
            <TerminalText
              style={styles.drawLabel}
              tone={sponsorConfirmed ? 'pink' : 'amber'}
              variant="label"
            >
              15% OF PLAYERS GET PAID
            </TerminalText>
          </HUDBorderBox>

          <View style={styles.primaryActions}>
            <CyberButtonPrimary
              label="CREATE ACCOUNT ->"
              onPress={() => router.push('/join')}
            />
          </View>
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function WelcomeStepCell({ step }: { step: WelcomeStep }) {
  const tone = step.accent;

  return (
    <View style={styles.stepCell}>
      <TerminalText glow style={styles.stepNumber} tone={tone} variant="label">
        {step.index}
      </TerminalText>
      <TerminalText style={styles.stepTitle} tone="text" variant="micro">
        {step.title}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  sponsorBanner: {
    marginBottom: spacing.lg
  },
  statusRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderCyanMedium,
    borderRadius: 8,
    backgroundColor: colors.surfaceCyanWhisper
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  introStack: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.lg
  },
  logoShell: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  logoWord: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.logo,
    lineHeight: 58,
    letterSpacing: 1.2
  },
  primaryActions: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.sm
  },
  stepStrip: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm
  },
  stepCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 3
  },
  stepNumber: {
    fontFamily: fontFamilies.display
  },
  stepTitle: {
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  sponsorLine: {
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  entryPanel: {
    alignItems: 'stretch',
    paddingVertical: 24,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm
  },
  entryIntro: {
    textAlign: 'center'
  },
  entryTitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  entryActivation: {
    marginTop: -4,
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  entryDetailRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch'
  },
  prizeBlock: {
    flex: 0.82,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderPinkMuted,
    borderRadius: 8,
    backgroundColor: colors.surfacePinkSoft
  },
  pendingPrizeBlock: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  prizeValue: {
    marginTop: 2,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 28,
    textAlign: 'center'
  },
  prizePending: {
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  sponsorAd: {
    flex: 1.18,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 8,
    backgroundColor: colors.surfaceCyanWhisper
  },
  pendingSponsorAd: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  sponsorAdCopy: {
    flex: 1
  },
  sponsorAdTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.display
  },
  drawLabel: {
    marginTop: spacing.xs,
    textAlign: 'center'
  },
});
