import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { useCreatorWorkouts } from '@/data/appDataHooks';
import { goBackOrReplace } from '@/navigation/goBack';
import { useSponsorCampaign } from '@/state/sponsorCampaign';

type RuleItem = {
  body: string;
};

const ruleItems: readonly RuleItem[] = [
  { body: 'FREE TO JOIN // YOUR FREE PRIZE DRAW ENTRY IS SECURED IMMEDIATELY.' },
  {
    body: 'CREATOR PAYOUT IS BASED ON GOGYMGO SELECTION AND VERIFIED COMPLETIONS, NOT YOUTUBE VIEWS.'
  },
  { body: 'SPONSOR CREATIVE STAYS OUTSIDE THE YOUTUBE PLAYER.' },
  { body: 'USERS EARN ENTRIES ONLY AFTER HEART-RATE OR QR VERIFICATION.' }
];

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { campaign } = useSponsorCampaign();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const { data: creatorWorkouts = [], isPending } = useCreatorWorkouts();
  const workout = creatorWorkouts.find((item) => item.id === workoutId);
  const sponsorConfirmed = campaign.status === 'approved';

  if (isPending) {
    return null;
  }

  if (!workout?.joined) {
    return (
      <ScreenContainer contentStyle={styles.unavailableScreen}>
        <HUDBorderBox glow style={styles.unavailableCard} tone="red">
          <TerminalText glow tone="red" variant="label">
            WORKOUT UNAVAILABLE
          </TerminalText>
          <TerminalText glow style={styles.unavailableTitle} tone="text" variant="title">
            WORKOUT NOT AVAILABLE YET
          </TerminalText>
          <TerminalText style={styles.unavailableBody} tone="muted" variant="body">
            THIS CREATOR SLOT IS STILL IN SUBMISSION OR REVIEW. RETURN TO THE
            WORKOUT LIST FOR THE CURRENT FEATURED SESSION.
          </TerminalText>
          <CyberButtonPrimary
            label="BACK TO CREATOR WORKOUTS ->"
            onPress={() => router.replace('/workouts')}
            style={styles.unavailableAction}
          />
        </HUDBorderBox>
      </ScreenContainer>
    );
  }

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
            onPress={() => goBackOrReplace(router, '/workouts')}
            style={styles.backButton}
          />
          <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
            CREATOR WORKOUT // {campaign.region}
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.creatorHeader} tone="cyan">
          <View style={styles.creatorAvatar}>
            <TerminalText style={styles.creatorAvatarText} tone="dim" variant="button">
              AX
            </TerminalText>
          </View>
          <View style={styles.creatorCopy}>
              <TerminalText style={styles.creatorTitle} tone="text" uppercase variant="body">
              {workout.name}
            </TerminalText>
            <TerminalText style={styles.metadataBody} tone="muted" variant="body">
              LED BY APEX ATHLETICS // OFFICIAL GOGYMGO CHANNEL
            </TerminalText>
          </View>
        </HUDBorderBox>

        <View style={styles.youtubeFrame}>
          <View style={styles.youtubePlayer}>
            <View style={styles.youtubePlay}>
              <TerminalText glow tone="text" variant="micro">
                PLAY
              </TerminalText>
            </View>
            <View style={styles.channelRow}>
              <TerminalText style={styles.youtubeLogo} tone="pink" variant="micro">
                YOUTUBE
              </TerminalText>
              <TerminalText style={styles.channelText} tone="muted" variant="micro">
                GOGYMGO OFFICIAL CHANNEL
              </TerminalText>
            </View>
          </View>
        </View>
        <TerminalText style={styles.youtubeFootnote} tone="dim" variant="micro">
          VIDEO PLAYS ON THE OFFICIAL GOGYMGO YOUTUBE CHANNEL.
        </TerminalText>

        <TerminalText style={styles.startHelper} tone="cyan" uppercase={false} variant="body">
          Start your verified GoGymGo session first, then play the video. The
          video alone does not count as a verified workout.
        </TerminalText>

        <CyberButtonPrimary
          label="START VERIFIED SESSION ->"
          onPress={() => router.push('/workout/method')}
          style={styles.startButton}
          tone="cyan"
        />

        <HUDBorderBox style={styles.selectionCard} tone={sponsorConfirmed ? 'pink' : 'cyan'}>
          <TerminalText glow tone={sponsorConfirmed ? 'pink' : 'cyan'} variant="label">
            {sponsorConfirmed ? `${campaign.sponsor.displayName} CREATOR PAYOUT` : 'REGIONAL CREATOR CAMPAIGN'}
          </TerminalText>
          <TerminalText style={styles.selectionCopy} tone="muted" variant="body">
            {sponsorConfirmed
              ? `SPONSOR FUNDING SUPPORTS THE SELECTED ${campaign.region} WORKOUT LEADER.`
              : 'CREATOR PAYOUT DETAILS ARE PUBLISHED WITH THE REGIONAL CAMPAIGN.'}
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.rulesCard} tone="muted">
          <TerminalText tone="dim" variant="label">
            OFFICIAL RULES
          </TerminalText>
          <View style={styles.rulesList}>
            {ruleItems.map((rule) => (
              <View key={rule.body} style={styles.ruleRow}>
                <TerminalText glow tone="cyan" variant="micro">
                  OK
                </TerminalText>
                <TerminalText style={styles.ruleText} tone="muted" variant="body">
                  {rule.body}
                </TerminalText>
              </View>
            ))}
          </View>
        </HUDBorderBox>

      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  unavailableScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenX,
    backgroundColor: colors.background
  },
  unavailableCard: {
    padding: spacing.xxl
  },
  unavailableTitle: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display
  },
  unavailableBody: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body
  },
  unavailableAction: {
    marginTop: spacing.xl
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  creatorAvatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  creatorAvatarText: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  creatorCopy: {
    flex: 1
  },
  creatorTitle: {
    marginBottom: 2,
    fontFamily: fontFamilies.display
  },
  metadataBody: {
    fontFamily: fontFamilies.terminal
  },
  youtubeFrame: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.whiteAlpha10,
    borderRadius: radii.lg
  },
  youtubePlayer: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceVideoDark
  },
  youtubePlay: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: colors.statusError
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md
  },
  youtubeLogo: {
    color: colors.statusError,
    fontFamily: fontFamilies.display
  },
  channelText: {
    fontFamily: fontFamilies.terminal
  },
  youtubeFootnote: {
    marginTop: 7,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  pressableCard: {
    width: '100%'
  },
  safeSponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  safeSponsorMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: radii.md,
    backgroundColor: colors.surfacePinkSoft
  },
  safeSponsorCopy: {
    flex: 1
  },
  safeSponsorTitle: {
    marginVertical: spacing.xs,
    fontFamily: fontFamilies.display
  },
  selectionCard: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  selectionCopy: {
    marginTop: 7,
    fontFamily: fontFamilies.body
  },
  verificationCard: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg
  },
  verificationCopy: {
    marginTop: 7,
    fontFamily: fontFamilies.body
  },
  verificationList: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  verificationItemText: {
    flex: 1,
    fontFamily: fontFamilies.display
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: spacing.md
  },
  rewardCard: {
    flex: 1,
    padding: 14
  },
  rewardValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  rulesCard: {
    marginTop: spacing.md,
    padding: 15
  },
  rulesList: {
    gap: 9,
    marginTop: 10
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9
  },
  ruleText: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  startButton: {
    marginTop: 18
  },
  startHelper: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
