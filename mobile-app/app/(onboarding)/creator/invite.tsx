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
import { dismissCreatorInvite } from '@/state/creatorInvitePreference';

export default function CreatorInviteScreen() {
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
            OPTIONAL PATH
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            CREATOR
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          WANT TO LEAD WORKOUTS?
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          OPTIONAL: APPLY NOW OR COME BACK FROM PROFILE LATER. YOU CAN CONTINUE
          AS A PLAYER AND STILL FOLLOW CREATOR WORKOUTS.
        </TerminalText>

        <HUDBorderBox glow style={styles.applicationCard} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            CREATOR APPLICATION
          </TerminalText>
          <TerminalText style={styles.applicationTitle} tone="text" variant="title">
            APPLY AS A CREATOR
          </TerminalText>
          <TerminalText style={styles.applicationCopy} tone="muted" variant="body">
            SUBMIT A SAFE FOLLOW-ALONG WORKOUT FOR YOUR REGION. ELIGIBLE
            VIDEOS EARN 50 PRIZE DRAW ENTRIES; SELECTED WORKOUTS CAN RECEIVE
            A SPONSOR-FUNDED PAYOUT.
          </TerminalText>
          <View style={styles.applicationFacts}>
            <FactRow label="01" text="FOLLOW THE UPLOAD GUIDE." />
            <FactRow label="02" text="EARN 50 PRIZE DRAW ENTRIES." />
            <FactRow label="03" text="GET SELECTED FOR PAYOUT." />
          </View>
        </HUDBorderBox>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="CONTINUE AS PLAYER ->"
            onPress={() => router.push('/creator')}
          />
          <CyberButtonOutline
            label="LEARN MORE"
            onPress={() => router.push('/creator/guidelines')}
          />
          <CyberButtonOutline
            label="APPLY AS CREATOR ->"
            onPress={() => router.push('/creator/apply')}
            tone="pink"
          />
          <CyberButtonOutline
            label="DON'T SHOW AGAIN"
            onPress={() => {
              dismissCreatorInvite();
              router.replace('/creator');
            }}
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

function FactRow({ label, text }: { label: string; text: string }) {
  return (
    <HUDBorderBox style={styles.factRow} tone="muted">
      <TerminalText glow tone="cyan" variant="label">
        {label}
      </TerminalText>
      <TerminalText style={styles.factCopy} tone="cyan" variant="body">
        {text}
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
    width: '40%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.terminal
  },
  applicationCard: {
    gap: spacing.sm,
    padding: 16
  },
  applicationTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  applicationCopy: {
    fontFamily: fontFamilies.terminal
  },
  applicationFacts: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: 12
  },
  factCopy: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  actions: {
    marginTop: 20,
    gap: spacing.md
  }
});
