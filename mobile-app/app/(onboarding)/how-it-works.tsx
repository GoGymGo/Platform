import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type LoopStep = {
  body: string;
  index: string;
  title: string;
  tone: 'cyan' | 'pink';
};

const loopSteps: readonly LoopStep[] = [
  {
    body: 'PICK 1 TO 7 VERIFIED WORKOUT DAYS FOR THE MONTH.',
    index: '01',
    title: 'CHOOSE A WEEKLY GOAL',
    tone: 'cyan'
  },
  {
    body: 'USE HEART RATE OR PARTNER GYM QR, PLUS QUICK IDENTITY CHECKS.',
    index: '02',
    title: 'VERIFY EACH SESSION',
    tone: 'cyan'
  },
  {
    body: 'ENTRIES IMPROVE YOUR MONTHLY PRIZE DRAW ODDS.',
    index: '03',
    title: 'BUILD PRIZE DRAW ODDS',
    tone: 'cyan'
  }
];

export default function HowItWorksScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <TerminalText tone="dim" variant="label">
            OPTIONAL GUIDE
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            HOW IT WORKS
          </TerminalText>
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          THE LOOP IS SIMPLE
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          COMMIT, VERIFY, EARN ENTRIES. OPEN THE BONUS RULES IF YOU WANT THE
          FINE PRINT BEFORE CHOOSING YOUR WEEKLY GOAL.
        </TerminalText>

        <View style={styles.loopList}>
          {loopSteps.map((step) => (
            <LoopStepRow key={step.index} step={step} />
          ))}
        </View>

        <HUDBorderBox glow style={styles.pairingPanel} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            PAIRING BONUS
          </TerminalText>
          <TerminalText style={styles.pairingCopy} tone="cyan" variant="body">
            BOTH HIT THE GOAL: YOU BOTH EARN 2X. IF YOUR MATCH MISSES: COMPLETE
            ONE EXTRA VERIFIED WORKOUT TO EARN 3X AND CLAIM THEIR UNEARNED BONUS
            ENTRIES.
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.actions}>
          <CyberButtonOutline
            label="VIEW BONUS RULES"
            onPress={() => router.push('/bonus-rules')}
          />
          <CyberButtonOutline
            label="DON'T SHOW ME AGAIN"
            onPress={() => router.replace('/commitment')}
          />
          <CyberButtonPrimary
            label="GOT IT - LET'S COMMIT ->"
            onPress={() => router.push('/commitment')}
          />
          <CyberButtonOutline
            label="BACK"
            onPress={() => router.back()}
          />
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

function LoopStepRow({ step }: { step: LoopStep }) {
  const isPink = step.tone === 'pink';
  const tone = isPink ? 'pink' : 'cyan';

  return (
    <HUDBorderBox glow={isPink} style={styles.loopStep} tone={tone}>
      <TerminalText glow style={styles.loopIndex} tone={tone} variant="label">
        {step.index}
      </TerminalText>
      <View style={styles.loopCopy}>
        <TerminalText glow={isPink} style={styles.loopTitle} tone="text" variant="body">
          {step.title}
        </TerminalText>
        <TerminalText tone="muted" variant="micro">
          {step.body}
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
    backgroundColor: colors.surfacePink
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
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    marginBottom: 18,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  loopList: {
    gap: 10,
    marginBottom: 14
  },
  loopStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: 14
  },
  loopIndex: {
    width: 28,
    fontFamily: fontFamilies.display
  },
  loopCopy: {
    flex: 1,
    gap: 2
  },
  loopTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  pairingPanel: {
    marginBottom: spacing.md,
    gap: spacing.xs,
    paddingVertical: 13,
    paddingHorizontal: 14
  },
  pairingCopy: {
    fontFamily: fontFamilies.terminal
  },
  actions: {
    gap: spacing.md,
    marginTop: 2
  }
});
