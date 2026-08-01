import { useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { GoGymGoWordmark } from '@/components/brandWordmark';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

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
  const { width: viewportWidth } = useWindowDimensions();
  const compactLogo = viewportWidth < 360;

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.introStack}>
          <View style={styles.statusRail}>
            <View style={styles.onlineDot} />
            <TerminalText glow tone="cyan" variant="label">
              SYSTEM ONLINE // REGISTRATION OPEN
            </TerminalText>
          </View>

          <View style={styles.logoShell}>
            <GoGymGoWordmark compact={compactLogo} />
          </View>

          <TerminalText style={styles.valueProp} tone="text" uppercase={false} variant="body">
            Complete verified workouts, compete in your region and earn chances
            to win brand rewards.
          </TerminalText>

          <HUDBorderBox style={styles.stepStrip} tone="cyan">
            {welcomeSteps.map((step) => (
              <WelcomeStepCell key={step.index} step={step} />
            ))}
          </HUDBorderBox>

          <TerminalText style={styles.sponsorLine} tone="dim" variant="label">
            FREE TO PLAY // FUNDED BY SPONSORS
          </TerminalText>

          <View style={styles.primaryActions}>
            <CyberButtonPrimary
              label="GET STARTED ->"
              onPress={() => router.push('/join')}
            />
            <CyberButtonOutline
              accessibilityHint="Open the returning player sign-in screen"
              label="SIGN IN"
              onPress={() => router.push('/sign-in')}
            />
          </View>

          <HUDBorderBox glow style={styles.entryPanel} tone="cyan">
            <TerminalText glow style={styles.entryTitle} tone="pink" variant="value">
              FREE ENTRY
            </TerminalText>
            <TerminalText style={styles.entryCopy} tone="muted" uppercase={false} variant="body">
              Create your player account and receive one entry into the monthly
              regional prize draw.
            </TerminalText>
            <TerminalText style={styles.drawLabel} tone="cyan" variant="label">
              SPONSOR-FUNDED PRIZES + COUPON CODES
            </TerminalText>
          </HUDBorderBox>

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
  valueProp: {
    maxWidth: 350,
    paddingHorizontal: spacing.sm,
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.body,
    lineHeight: 22,
    textAlign: 'center'
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
  entryTitle: {
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  entryCopy: {
    maxWidth: 310,
    alignSelf: 'center',
    fontFamily: fontFamilies.body,
    lineHeight: 21,
    textAlign: 'center'
  },
  drawLabel: {
    marginTop: spacing.xs,
    textAlign: 'center'
  },
});
