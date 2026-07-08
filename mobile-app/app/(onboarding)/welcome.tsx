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
import { LegalConsentCheckbox, LegalDocumentLinks } from '@/components/legal';
import { accountLegalConsentLabels } from '@/constants/legal';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type Accent = 'cyan';

type WelcomeStep = {
  accent: Accent;
  index: string;
  marker: string;
  subtitle: string;
  title: string;
};

const welcomeSteps: readonly WelcomeStep[] = [
  {
    accent: 'cyan',
    index: '01',
    marker: 'IN',
    subtitle: 'CHECK IN AT THE GYM',
    title: 'SHOW UP'
  },
  {
    accent: 'cyan',
    index: '02',
    marker: 'ID',
    subtitle: 'VERIFY YOUR WORKOUT',
    title: 'PROVE IT'
  },
  {
    accent: 'cyan',
    index: '03',
    marker: 'WIN',
    subtitle: 'EARN PRIZE DRAW ENTRIES',
    title: 'WIN'
  }
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const accountLegalAccepted = privacyAccepted && termsAccepted;

  return (
    <ScreenContainer>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SponsorBanner />

        <View style={styles.introStack}>
          <View style={styles.statusRail}>
            <View style={styles.onlineDot} />
            <TerminalText glow tone="cyan" variant="label">
              SYSTEM ONLINE // ENTRY OPEN
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

          <View style={styles.stepList}>
            {welcomeSteps.map((step) => (
              <WelcomeStepRow key={step.index} step={step} />
            ))}
          </View>

          <TerminalText style={styles.sponsorLine} tone="dim" variant="label">
            FREE TO PLAY // FUNDED BY SPONSORS
          </TerminalText>

          <HUDBorderBox glow style={styles.entryPanel} tone="cyan">
            <TerminalText style={styles.entryIntro} tone="muted" variant="label">
              ON SIGNUP YOU RECEIVE
            </TerminalText>
            <TerminalText glow style={styles.entryTitle} tone="cyan" variant="value">
              1 FREE ENTRY
            </TerminalText>
            <View style={styles.entryDetailRow}>
              <View style={styles.prizeBlock}>
                <TerminalText tone="muted" variant="micro">
                  CURRENT PRIZE POOL
                </TerminalText>
                <TerminalText glow style={styles.prizeValue} tone="pink" variant="title">
                  $5,000
                </TerminalText>
              </View>
              <View style={styles.sponsorAd}>
                <View style={styles.entrySponsorMark}>
                  <TerminalText glow tone="pink" variant="label">
                    V
                  </TerminalText>
                </View>
                <View style={styles.sponsorAdCopy}>
                  <TerminalText tone="dim" variant="micro">
                    MONTH SPONSOR
                  </TerminalText>
                  <TerminalText style={styles.sponsorAdTitle} tone="text" variant="body">
                    VOLT RECOVERY FUEL
                  </TerminalText>
                </View>
              </View>
            </View>
            <TerminalText style={styles.drawLabel} tone="pink" variant="label">
              CURRENT REGIONAL PRIZE DRAW
            </TerminalText>
          </HUDBorderBox>

          <View style={styles.legalStack}>
            <View style={styles.legalHeader}>
              <TerminalText glow tone="cyan" variant="label">
                LEGAL CHECKPOINT
              </TerminalText>
              <TerminalText style={styles.legalIntro} tone="muted" variant="micro">
                CHECK BOTH BOXES TO ENABLE ACCOUNT CREATION
              </TerminalText>
            </View>
            <LegalDocumentLinks />
            <LegalConsentCheckbox
              checked={privacyAccepted}
              label={accountLegalConsentLabels.privacy}
              onToggle={() => setPrivacyAccepted((current) => !current)}
            />
            <LegalConsentCheckbox
              checked={termsAccepted}
              label={accountLegalConsentLabels.terms}
              onToggle={() => setTermsAccepted((current) => !current)}
            />
          </View>

          <View style={styles.primaryActions}>
            <CyberButtonPrimary
              disabled={!accountLegalAccepted}
              label="CREATE ACCOUNT ->"
              onPress={() => router.push('/identity')}
            />
            <CyberButtonOutline
              label="I ALREADY HAVE AN ACCOUNT"
              onPress={() => router.replace('/home')}
            />
          </View>
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

function WelcomeStepRow({ step }: { step: WelcomeStep }) {
  const tone = step.accent;

  return (
    <HUDBorderBox glow style={styles.stepRow} tone={tone}>
      <View style={[styles.stepMarker, styles.markerCyan]}>
        <TerminalText glow tone={tone} variant="label">
          {step.marker}
        </TerminalText>
      </View>
      <View style={styles.stepTextBlock}>
        <TerminalText glow style={styles.stepTitle} tone={tone} variant="title">
          {step.title}
        </TerminalText>
        <TerminalText tone="muted" variant="micro">
          {step.subtitle}
        </TerminalText>
      </View>
      <TerminalText tone={tone} variant="label">
        {step.index}
      </TerminalText>
    </HUDBorderBox>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 42,
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
    backgroundColor: colors.surfacePink
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
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
    shadowColor: colors.cyan,
    shadowOpacity: 0.72,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4
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
  legalStack: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  legalHeader: {
    gap: 2
  },
  legalIntro: {
    fontFamily: fontFamilies.terminal
  },
  stepList: {
    width: '100%',
    gap: spacing.md
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  stepMarker: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10
  },
  markerCyan: {
    borderColor: colors.borderCyanMedium,
    backgroundColor: colors.surfaceCyanSoft
  },
  stepTextBlock: {
    flex: 1
  },
  stepTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.stat,
    lineHeight: 24
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
  prizeValue: {
    marginTop: 2,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 28
  },
  sponsorAd: {
    flex: 1.18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanQuiet,
    borderRadius: 8,
    backgroundColor: colors.surfaceCyanWhisper
  },
  entrySponsorMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 8,
    backgroundColor: colors.surfacePink
  },
  sponsorAdCopy: {
    flex: 1
  },
  sponsorAdTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
  drawLabel: {
    marginTop: spacing.xs,
    textAlign: 'center'
  },
});
