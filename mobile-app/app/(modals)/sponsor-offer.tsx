import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useSponsorCampaign } from '@/state/sponsorCampaign';

export default function SponsorOfferModal() {
  const router = useRouter();
  const { campaign, enrollment } = useSponsorCampaign();
  const sponsorConfirmed = campaign.status === 'approved';
  const screenTone = sponsorConfirmed ? 'pink' : 'cyan';
  const sponsorFacts = sponsorConfirmed
    ? [
        'SUPPLIES PHYSICAL PRIZES AND COUPON CODES FOR THE REGIONAL CONTEST',
        `${Math.round(campaign.economics.rewardWinnerRate * 100)}% OF PLAYERS IS THE PROJECTED REWARD INVENTORY`,
        `REQUIRES ${enrollment.minimumEntrants} REGISTERED PLAYERS ACROSS THE REGION TO LAUNCH`,
        enrollment.maximumEntrants === null
          ? 'THIS REGIONAL CAMPAIGN HAS NO PLAYER CAP'
          : `THIS REGIONAL CAMPAIGN HAS A ${enrollment.maximumEntrants.toLocaleString()}-PLAYER SPONSOR CAP`,
        'FEATURES SELECTED LOCAL CREATORS AND THEIR FOLLOW-ALONG WORKOUTS'
      ]
    : [
        'REGIONAL SPONSOR AND PRIZE DETAILS WILL BE PUBLISHED BEFORE THE COMPETITION',
        'REWARD INVENTORY HAS NOT BEEN PUBLISHED',
        'REGISTRATION AND LAUNCH REQUIREMENTS WILL APPEAR WITH THE CAMPAIGN',
        'NO PLAYER CAP HAS BEEN PUBLISHED',
        'CREATOR FEATURE DETAILS WILL APPEAR WITH THE SPONSOR ANNOUNCEMENT'
      ];
  const closeOffer = () => goBackOrReplace(router, '/home');

  return (
    <ScreenContainer contentStyle={styles.sheet}>
      <View style={styles.header}>
        <TerminalText glow tone={screenTone} variant="label">
          {sponsorConfirmed ? 'SPONSOR OFFER' : 'SPONSOR ANNOUNCEMENT'}
        </TerminalText>
        <CyberButtonOutline
          label="CLOSE"
          onPress={closeOffer}
          style={styles.closeButton}
        />
      </View>

      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HUDBorderBox glow style={styles.heroCard} tone={screenTone}>
          <View style={styles.logoMark}>
            <TerminalText glow style={styles.logoText} tone={screenTone} variant="display">
              {campaign.sponsor.mark}
            </TerminalText>
          </View>
          <TerminalText style={styles.sponsorName} tone="text" variant="title">
            {campaign.sponsor.displayName}
          </TerminalText>
          <TerminalText tone="muted" variant="body">
            MONTHLY SPONSOR // {campaign.region}
          </TerminalText>
          <TerminalText glow style={styles.offerTitle} tone={screenTone} variant="body">
            {campaign.sponsor.offerHeadline}
          </TerminalText>
          <TerminalText glow style={styles.offerCode} tone="cyan" variant="label">
            {sponsorConfirmed ? `CODE: ${campaign.sponsor.offerCode}` : 'CAMPAIGN DETAILS COMING SOON'}
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.factList}>
          {sponsorFacts.map((fact) => (
            <HUDBorderBox key={fact} style={styles.factRow} tone="cyan">
              <TerminalText glow tone="cyan" variant="micro">
                {sponsorConfirmed ? 'OK' : 'INFO'}
              </TerminalText>
              <TerminalText style={styles.factText} tone={sponsorConfirmed ? 'cyan' : 'muted'} variant="body">
                {fact}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>

        <CyberButtonOutline
          label="BACK TO APP"
          onPress={closeOffer}
          style={styles.secondaryButton}
        />
      </ScreenScrollView>
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
    minHeight: 44,
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
    fontFamily: fontFamilies.body
  },
  secondaryButton: {
    marginTop: 0
  }
});
