import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { SponsorRail } from '@/components/sponsor';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';

type JoinOption = {
  category: string;
  label: string;
  route: Href;
};

const applicationOptions: readonly JoinOption[] = [
  {
    category: 'CREATOR',
    label: 'APPLY AS A CREATOR',
    route: '/creator/apply?source=join' as Href
  },
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
  const [showPartnerOptions, setShowPartnerOptions] = useState(false);

  return (
    <ScreenContainer>
      <SponsorRail compact />
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
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            HOW DO YOU WANT TO JOIN?
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Players can create an account or sign in below. Creator, sponsor and
            partner-gym tools are available separately.
          </TerminalText>
        </View>

        <View style={styles.section}>
          <TerminalText tone="dim" variant="label">
            FOR PLAYERS
          </TerminalText>
          <CyberButtonPrimary
            label="CREATE PLAYER ACCOUNT ->"
            onPress={() => router.push('/sign-up')}
          />
          <CyberButtonOutline
            label="SIGN IN TO EXISTING ACCOUNT"
            onPress={() => router.push('/sign-in')}
          />
        </View>

        <View style={styles.section}>
          <CyberButtonOutline
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
    </ScreenContainer>
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
          <TerminalText glow tone="cyan" variant="micro">
            {option.category}
          </TerminalText>
          <TerminalText tone="text" variant="body">
            {option.label}
          </TerminalText>
        </View>
        <TerminalText glow tone="cyan" variant="button">
          {'->'}
        </TerminalText>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    gap: spacing.sm,
    alignItems: 'center'
  },
  title: {
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  section: {
    gap: spacing.md
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
