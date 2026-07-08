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

type ApplicationTone = 'cyan' | 'pink';

type ApplicationStep = {
  body: string;
  index: string;
  title: string;
  tone: ApplicationTone;
};

const applicationSteps: readonly ApplicationStep[] = [
  {
    body: '20-45 MINUTES, CLEAR COACHING, REGION AND EQUIPMENT LISTED.',
    index: '01',
    title: 'SUBMIT A FOLLOW-ALONG WORKOUT',
    tone: 'cyan'
  },
  {
    body: 'MUSIC, LIKENESS RIGHTS, SAFETY NOTES AND DISCLOSURES ARE CHECKED.',
    index: '02',
    title: 'ACCEPT RIGHTS + DISCLOSURE REVIEW',
    tone: 'pink'
  },
  {
    body: 'EVERY GUIDELINE-COMPLIANT VIDEO SUBMISSION EARNS 50 PRIZE DRAW ENTRIES.',
    index: '03',
    title: 'EARN SUBMISSION ENTRIES',
    tone: 'cyan'
  },
  {
    body: 'FEATURED WORKOUTS CAN RECEIVE A SPONSOR-FUNDED PAYOUT.',
    index: '04',
    title: 'GET SELECTED, GET PAID',
    tone: 'pink'
  }
];

export default function CreatorApplyScreen() {
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
            OPTIONAL APPLICATION
          </TerminalText>
          <TerminalText glow tone="pink" variant="label">
            CREATOR
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          APPLY TO LEAD A LOCAL WORKOUT
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          CREATORS CAN SUBMIT MONTHLY FOLLOW-ALONG VIDEOS FOR THEIR REGION.
          GUIDELINE-COMPLIANT SUBMISSIONS EARN 50 PRIZE DRAW ENTRIES, AND
          GOGYMGO REVIEWS SAFETY, RIGHTS AND REGION FIT BEFORE SELECTING FEATURED
          WORKOUTS.
        </TerminalText>

        <View style={styles.stepList}>
          {applicationSteps.map((step) => (
            <ApplicationStepRow key={step.index} step={step} />
          ))}
        </View>

        <HUDBorderBox style={styles.sponsorBrief} tone="muted">
          <View style={styles.sponsorBriefMark}>
            <TerminalText glow tone="pink" variant="title">
              V
            </TerminalText>
          </View>
          <View style={styles.sponsorBriefCopy}>
            <TerminalText tone="dim" variant="micro">
              SPONSOR AREA // CREATOR SIGNUP
            </TerminalText>
            <TerminalText style={styles.sponsorBriefTitle} tone="text" variant="body">
              CREATOR PAYOUT INFO
            </TerminalText>
            <TerminalText tone="muted" variant="body">
              APPROVED CREATOR BRIEFS SHOW PAYOUT, DISCLOSURE AND BRAND RULES.
            </TerminalText>
          </View>
        </HUDBorderBox>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="APPLY AS CREATOR ->"
            onPress={() => router.push('/consents')}
            tone="pink"
          />
          <CyberButtonOutline
            label="CONTINUE AS PLAYER"
            onPress={() => router.push('/consents')}
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

function ApplicationStepRow({ step }: { step: ApplicationStep }) {
  const isPink = step.tone === 'pink';
  const tone = isPink ? 'pink' : 'cyan';

  return (
    <HUDBorderBox glow={isPink} style={styles.applicationStep} tone={tone}>
      <TerminalText glow style={styles.applicationIndex} tone={tone} variant="label">
        {step.index}
      </TerminalText>
      <View style={styles.applicationCopy}>
        <TerminalText glow={isPink} style={styles.applicationTitle} tone="text" variant="body">
          {step.title}
        </TerminalText>
        <TerminalText tone={isPink ? 'pink' : 'cyan'} variant="body">
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
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    width: '46%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
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
    fontFamily: fontFamilies.terminal
  },
  stepList: {
    gap: 11
  },
  applicationStep: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  applicationIndex: {
    width: 28,
    fontFamily: fontFamilies.display
  },
  applicationCopy: {
    flex: 1,
    gap: 3
  },
  applicationTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.body,
    lineHeight: 19
  },
  sponsorBrief: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  sponsorBriefMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 10,
    backgroundColor: colors.surfacePinkSoft
  },
  sponsorBriefCopy: {
    flex: 1
  },
  sponsorBriefTitle: {
    marginTop: 4,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.button,
    lineHeight: 18
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl
  }
});
