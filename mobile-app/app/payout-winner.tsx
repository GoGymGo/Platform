import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useCurrentUserPayout } from '@/data/appDataHooks';
import { formatPayoutAmount } from '@/domain/payout';
import { markPayoutWinnerNoticeSeen } from '@/services/payouts';
import { useAuth } from '@/state/auth';

export default function PayoutWinnerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: claim, isPending } = useCurrentUserPayout(user?.uid);

  if (isPending) {
    return (
      <ScreenContainer contentStyle={styles.loading}>
        <ActivityIndicator
          accessibilityLabel="Loading"
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          color={colors.cyan}
          size="large"
        />
      </ScreenContainer>
    );
  }

  if (!claim) {
    return <Redirect href="/home" />;
  }
  const confirmedClaim = claim;

  async function continueToPayout() {
    if (!user) {
      router.replace('/sign-in');
      return;
    }
    await markPayoutWinnerNoticeSeen(user.uid, confirmedClaim.id);
    router.replace('/profile/payout');
  }

  async function returnHome() {
    if (!user) {
      router.replace('/sign-in');
      return;
    }
    await markPayoutWinnerNoticeSeen(user.uid, confirmedClaim.id);
    router.replace('/home');
  }

  return (
    <AuthGate>
      <ScreenContainer contentStyle={styles.screen}>
        <View style={styles.hero}>
          <HUDBorderBox glow style={styles.winnerBadge} tone="pink">
            <TerminalText glow tone="pink" variant="label">
              VERIFIED WINNER
            </TerminalText>
          </HUDBorderBox>

          <TerminalText glow style={styles.title} tone="pink" variant="title">
            YOU WON MONEY
          </TerminalText>
          <TerminalText style={styles.amount} glow tone="pink" variant="value">
            {formatPayoutAmount(claim)}
          </TerminalText>
          <TerminalText style={styles.competition} tone="text" variant="label">
            {claim.competitionLabel}
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            To receive your prize, set up a secure Hyperwallet payout account. Hyperwallet
            will verify your identity and collect your bank details directly.
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.securityCard} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            YOUR BANK DETAILS STAY PRIVATE
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            GoGymGo never sees or stores your full bank account information. You will
            leave GoGymGo briefly to complete setup with Hyperwallet.
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="SET UP HYPERWALLET ->"
            onPress={continueToPayout}
            tone="pink"
          />
          <CyberButtonOutline label="DO THIS LATER" onPress={returnHome} />
        </View>
      </ScreenContainer>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  screen: {
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.background
  },
  hero: {
    alignItems: 'center'
  },
  winnerBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  title: {
    marginTop: spacing.xl,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 34,
    textAlign: 'center'
  },
  amount: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  competition: {
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control,
    lineHeight: 23,
    textAlign: 'center'
  },
  securityCard: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl
  }
});
