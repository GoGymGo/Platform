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

type GuidelineTone = 'cyan' | 'pink';

type GuidelineItem = {
  body: string;
  index: string;
  title: string;
  tone: GuidelineTone;
};

const guidelineItems: readonly GuidelineItem[] = [
  {
    body: 'CLEAR COACHING, SAFE MOVEMENT CUES, CLEAN AUDIO, REGION, EQUIPMENT AND DURATION INCLUDED.',
    index: '01',
    title: 'FOLLOW THE UPLOAD GUIDE',
    tone: 'cyan'
  },
  {
    body: 'SUBMISSIONS GO THROUGH RIGHTS, SAFETY, MUSIC AND DISCLOSURE CHECKS.',
    index: '02',
    title: 'SUBMIT VIDEO OR APPROVED LINK',
    tone: 'cyan'
  },
  {
    body: 'EVERY GUIDELINE-COMPLIANT VIDEO SUBMISSION EARNS 50 PRIZE DRAW ENTRIES FOR THE CREATOR.',
    index: '03',
    title: 'EARN 50 PRIZE DRAW ENTRIES',
    tone: 'pink'
  },
  {
    body: 'FEATURED REGIONAL WORKOUTS CAN RECEIVE A SPONSOR-FUNDED PAYOUT.',
    index: '04',
    title: 'SPONSOR PAYOUT IF SELECTED',
    tone: 'pink'
  }
];

export default function CreatorGuidelinesScreen() {
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
            GUIDE
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CREATOR UPLOAD GUIDELINES
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          REVIEW THIS WHEN YOU ARE READY TO SUBMIT. YOU CAN CONTINUE AS A
          PLAYER NOW AND APPLY FROM PROFILE LATER.
        </TerminalText>

        <View style={styles.itemList}>
          {guidelineItems.map((item) => (
            <GuidelineRow item={item} key={item.index} />
          ))}
        </View>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="CONTINUE AS PLAYER ->"
            onPress={() => router.push('/creator')}
          />
          <CyberButtonOutline
            label="APPLY AS CREATOR ->"
            onPress={() => router.push('/creator/apply')}
            tone="pink"
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

function GuidelineRow({ item }: { item: GuidelineItem }) {
  const isPink = item.tone === 'pink';
  const tone = isPink ? 'pink' : 'cyan';

  return (
    <HUDBorderBox glow={isPink} style={styles.guidelineRow} tone={tone}>
      <TerminalText glow style={styles.guidelineIndex} tone={tone} variant="label">
        {item.index}
      </TerminalText>
      <View style={styles.guidelineCopy}>
        <TerminalText glow={isPink} style={styles.guidelineTitle} tone="text" variant="body">
          {item.title}
        </TerminalText>
        <TerminalText tone={isPink ? 'pink' : 'cyan'} variant="body">
          {item.body}
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
  itemList: {
    gap: 11
  },
  guidelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  guidelineIndex: {
    width: 28,
    fontFamily: fontFamilies.display
  },
  guidelineCopy: {
    flex: 1,
    gap: 3
  },
  guidelineTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl
  }
});
