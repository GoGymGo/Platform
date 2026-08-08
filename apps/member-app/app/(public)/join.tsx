import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import {
  FirstRunPrimaryButton,
  FirstRunScreen,
  FirstRunSecondaryButton
} from '@/components/firstRun';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAppData } from '@/data/appDataHooks';
import { useAuth } from '@/state/auth';

type JoinOption = {
  category: string;
  disabled?: boolean;
  label: string;
  route: Href;
};

const applicationOptions: readonly JoinOption[] = [
  {
    category: 'SPONSOR',
    label: 'APPLY AS A SPONSOR',
    route: '/sponsor/apply'
  },
  {
    category: 'PARTNER GYM',
    label: 'REGISTER A GYM',
    route: '/gym/register'
  }
];

export default function JoinScreen() {
  const router = useRouter();
  const { challengeInvite } = useLocalSearchParams<{ challengeInvite?: string }>();
  const { social } = useAppData();
  const { user } = useAuth();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [redeemingInvite, setRedeemingInvite] = useState(false);
  const [showPartnerOptions, setShowPartnerOptions] = useState(false);

  return (
    <FirstRunScreen>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="JOIN GOGYMGO"
          onBack={() => goBackOrReplace(router, '/')}
          progress={10}
          step="CHOOSE A PATH"
        />

        <View style={styles.header}>
          <TerminalText style={styles.title} tone="text" variant="title">
            HOW DO YOU WANT TO JOIN?
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Players can create an account or sign in below. Sponsors and
            Partner gym teams can use their dedicated application forms.
          </TerminalText>
        </View>

        {challengeInvite ? (
          <HUDBorderBox style={styles.inviteCard} tone="pink">
            <TerminalText tone="pink" variant="label">
              FRIEND CHALLENGE INVITATION
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              You were invited to a private GoGymGo challenge. Sign in or create an
              account, then accept the invitation.
            </TerminalText>
            {user ? (
              <FirstRunPrimaryButton
                disabled={redeemingInvite}
                label={redeemingInvite ? 'ACCEPTING...' : 'ACCEPT CHALLENGE ->'}
                onPress={() => {
                  setRedeemingInvite(true);
                  setInviteError(null);
                  void social.redeemContactInvitation(challengeInvite)
                    .then(() => router.replace('/squad/social'))
                    .catch(() => setInviteError('This invitation is invalid, expired or already used.'))
                    .finally(() => setRedeemingInvite(false));
                }}
                tone="pink"
              />
            ) : null}
            {inviteError ? (
              <TerminalText live="assertive" tone="red" uppercase={false} variant="caption">
                {inviteError}
              </TerminalText>
            ) : null}
          </HUDBorderBox>
        ) : null}

        <View style={styles.section}>
          <TerminalText tone="dim" variant="label">
            FOR PLAYERS
          </TerminalText>
          <FirstRunPrimaryButton
            label="CREATE PLAYER ACCOUNT ->"
            onPress={() => router.push(challengeInvite
              ? { pathname: '/sign-up', params: { challengeInvite } }
              : '/sign-up')}
          />
          <FirstRunSecondaryButton
            label="SIGN IN TO EXISTING ACCOUNT"
            onPress={() => router.push(challengeInvite
              ? { pathname: '/sign-in', params: { challengeInvite } }
              : '/sign-in')}
          />
        </View>

        <View style={styles.section}>
          <FirstRunSecondaryButton
            label={showPartnerOptions ? 'HIDE PARTNER OPTIONS' : 'PARTNER WITH GOGYMGO'}
            onPress={() => setShowPartnerOptions((visible) => !visible)}
          />
          {showPartnerOptions ? (
            <View style={styles.partnerOptions}>
              {applicationOptions.map((option) => (
                <JoinApplicationOption
                  key={option.label}
                  onPress={() => router.push(option.route)}
                  option={option}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.legalLinks}>
          <CompactTextButton
            label="PRIVACY"
            onPress={() => router.push('/privacy-policy')}
            tone="muted"
          />
          <CompactTextButton
            label="TERMS"
            onPress={() => router.push('/terms-of-service')}
            tone="muted"
          />
        </View>
      </ScreenScrollView>
    </FirstRunScreen>
  );
}

function JoinApplicationOption({
  onPress,
  option
}: {
  onPress: () => void;
  option: JoinOption;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.optionPressable, pressed ? styles.optionPressed : null]}
    >
      <HUDBorderBox style={styles.optionRow} tone="cyan">
        <View style={styles.optionCopy}>
          <TerminalText tone="cyan" variant="micro">
            {option.category}
          </TerminalText>
          <TerminalText tone="text" variant="body">
            {option.label}
          </TerminalText>
        </View>
        <TerminalText tone="cyan" uppercase={false} variant="button">
          {'→'}
        </TerminalText>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  header: {
    gap: spacing.sm,
    paddingLeft: 14,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  title: {
    fontFamily: fontFamilies.display,
    lineHeight: 30
  },
  body: {
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    lineHeight: 24
  },
  section: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  inviteCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  partnerOptions: {
    gap: spacing.sm
  },
  optionPressable: {
    width: '100%'
  },
  optionPressed: {
    opacity: 0.72
  },
  optionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  optionCopy: {
    flex: 1,
    gap: 2
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md
  }
});
