import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { SponsorRail } from '@/components/sponsor';
import { colors, componentSizes, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useCurrentUserPayout } from '@/data/appDataHooks';
import { canOpenPayoutPortal, formatPayoutAmount } from '@/domain/payout';
import { openHyperwalletPortal } from '@/services/payouts';
import { isApiUnavailableError } from '@/services/api/availability';
import { useAuth } from '@/state/auth';
import { useApi } from '@/state/api';

export default function PayoutAccountScreen() {
  const router = useRouter();
  const { api } = useApi();
  const { user } = useAuth();
  const { data: claim, isPending: payoutStatusPending } =
    useCurrentUserPayout(user?.uid);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<string>();

  async function connectHyperwallet() {
    if (!claim) {
      return;
    }

    setOpening(true);
    setMessage(undefined);
    try {
      const opened = await openHyperwalletPortal(api, claim);
      if (!opened) {
        setMessage('YOUR SECURE HYPERWALLET LINK IS NOT READY. TRY AGAIN LATER.');
      }
    } catch (error) {
      setMessage(isApiUnavailableError(error)
        ? 'PAYOUT ACTIONS REQUIRE A CONFIGURED API.'
        : 'HYPERWALLET COULD NOT BE OPENED. CHECK YOUR CONNECTION AND TRY AGAIN.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <ScreenContainer>
      <SponsorRail compact />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="ACCOUNT"
          onBack={() => router.replace('/profile')}
          step="PAYOUT ACCOUNT"
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          HYPERWALLET PAYOUTS
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Hyperwallet is GoGymGo&apos;s secure payout provider. You only need to create
          an account after you have been selected to receive money.
        </TerminalText>

        <HUDBorderBox
          glow={Boolean(claim)}
          style={styles.statusCard}
          tone={claim ? 'pink' : 'muted'}
        >
          <View style={styles.statusHeader}>
            <TerminalText tone="dim" variant="micro">
              PAYOUT STATUS
            </TerminalText>
            <TerminalText glow={Boolean(claim)} tone={claim ? 'pink' : 'muted'} variant="label">
              {payoutStatusPending
                ? 'CHECKING PAYOUT STATUS'
                : claim
                  ? 'ACTION REQUIRED'
                  : 'NOT NEEDED YET'}
            </TerminalText>
          </View>
          {claim ? (
            <>
              <TerminalText glow style={styles.claimAmount} tone="pink" variant="value">
                {formatPayoutAmount(claim)}
              </TerminalText>
              <TerminalText tone="text" variant="caption">
                {claim.competitionLabel}
              </TerminalText>
            </>
          ) : (
            <TerminalText tone="muted" uppercase={false} variant="body">
              If you win, a notification will appear in GoGymGo and this screen will
              unlock your secure Hyperwallet connection.
            </TerminalText>
          )}
        </HUDBorderBox>

        <HUDBorderBox style={styles.stepsCard} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            HOW IT WORKS
          </TerminalText>
          <PayoutStep index="01" text="GoGymGo confirms your prize and eligibility." />
          <PayoutStep index="02" text="Hyperwallet verifies your identity and tax details." />
          <PayoutStep index="03" text="You connect a bank account directly with Hyperwallet." />
          <PayoutStep index="04" text="Hyperwallet sends the approved prize to your bank." />
        </HUDBorderBox>

        <HUDBorderBox style={styles.privacyCard} tone="muted">
          <TerminalText tone="dim" variant="label">
            PRIVATE BY DESIGN
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Do not send banking information to GoGymGo support. GoGymGo stores only
            your payout status and provider reference—not your full account numbers.
          </TerminalText>
        </HUDBorderBox>

        {message ? (
          <TerminalText style={styles.message} tone="amber" variant="caption">
            {message}
          </TerminalText>
        ) : null}

        {claim ? (
          <CyberButtonPrimary
            disabled={opening || !canOpenPayoutPortal(claim)}
            label={opening ? 'OPENING HYPERWALLET...' : 'CONTINUE TO HYPERWALLET ->'}
            onPress={() => void connectHyperwallet()}
            tone="pink"
          />
        ) : (
          <CyberButtonOutline label="BACK TO PROFILE" onPress={() => router.replace('/profile')} />
        )}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function PayoutStep({ index, text }: { index: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <TerminalText glow tone="cyan" variant="label">
        {index}
      </TerminalText>
      <TerminalText style={styles.stepText} tone="muted" uppercase={false} variant="body">
        {text}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: componentSizes.tabScreenBottomInset,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control,
    lineHeight: 23,
    textAlign: 'center'
  },
  statusCard: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  claimAmount: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display
  },
  stepsCard: {
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  stepText: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  privacyCard: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  message: {
    marginBottom: spacing.md,
    textAlign: 'center'
  }
});
