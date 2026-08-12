import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import {
  FirstRunBrandRail,
  FirstRunPrimaryButton,
  FirstRunScreen,
  FirstRunSecondaryButton
} from '@/components/firstRun';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';

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

  return (
    <FirstRunScreen>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FirstRunBrandRail />
        <View style={styles.introStack}>
            <View style={styles.statusRail}>
              <View style={styles.onlineDot} />
              <TerminalText tone="green" variant="label">
                SYSTEM ONLINE // REGISTRATION OPEN
              </TerminalText>
            </View>

            <View style={styles.heroCopy}>
              <TerminalText style={styles.valueProp} tone="text" variant="title">
                VERIFY WORKOUTS.
              </TerminalText>
              <TerminalText style={styles.valueBody} tone="muted" uppercase={false} variant="body">
                Earn chances to win in your region.
              </TerminalText>
            </View>

            <HUDBorderBox style={styles.stepStrip} tone="cyan">
              {welcomeSteps.map((step) => (
                <WelcomeStepCell key={step.index} step={step} />
              ))}
            </HUDBorderBox>

            <TerminalText style={styles.sponsorLine} tone="pink" variant="label">
              FREE TO PLAY // FUNDED BY SPONSORS
            </TerminalText>

            <View style={styles.primaryActions}>
              <FirstRunPrimaryButton
                label="GET STARTED ->"
                onPress={() => router.push('/join')}
              />
              <FirstRunSecondaryButton
                accessibilityHint="Open the returning player sign-in screen"
                label="SIGN IN"
                onPress={() => router.push('/sign-in')}
              />
            </View>

            <HUDBorderBox style={styles.entryPanel} tone="pink">
              <TerminalText style={styles.entryTitle} tone="pink" variant="value">
                FREE ENTRY
              </TerminalText>
              <TerminalText style={styles.entryCopy} tone="muted" uppercase={false} variant="body">
                Create an account to receive one monthly Prize Draw entry.
              </TerminalText>
              <TerminalText style={styles.drawLabel} tone="pink" variant="label">
                SPONSOR-FUNDED PRIZES + COUPON CODES
              </TerminalText>
            </HUDBorderBox>

        </View>
      </ScreenScrollView>
    </FirstRunScreen>
  );
}

function WelcomeStepCell({ step }: { step: WelcomeStep }) {
  const tone = step.accent;

  return (
    <View style={styles.stepCell}>
      <TerminalText style={styles.stepNumber} tone={tone} variant="label">
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  sponsorBanner: {
    marginBottom: spacing.lg
  },
  statusRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.green
  },
  introStack: {
    width: '100%',
    gap: spacing.xl
  },
  heroCopy: {
    gap: spacing.md,
    paddingLeft: 14,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  valueProp: {
    maxWidth: 390,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34
  },
  valueBody: {
    maxWidth: 390,
    fontFamily: fontFamilies.ui,
    fontSize: 17,
    lineHeight: 25
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
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceCyanGhost
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
    paddingVertical: spacing.xl,
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
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center'
  },
  drawLabel: {
    marginTop: spacing.xs,
    textAlign: 'center'
  },
});
