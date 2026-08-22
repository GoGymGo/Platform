import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';

const partnerOptions = [
  {
    body: 'Fund a regional campaign and provide physical or digital rewards.',
    route: '/sponsor/apply' as Href,
    title: 'APPLY AS A SPONSOR'
  },
  {
    body: 'Request a Contest QR that lets players select and location-verify your gym.',
    route: '/gym/register' as Href,
    title: 'REGISTER A PARTNER GYM'
  },
  {
    body: 'Share a creator profile and sample workout. The program remains unavailable unless explicitly enabled.',
    route: '/creator/apply?source=profile' as Href,
    title: 'APPLY AS A CREATOR'
  }
] as const;

export default function PartnerScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={brandScreenStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="PARTNER PORTAL"
          onBack={() => goBackOrReplace(router, '/profile')}
          step="APPLICATIONS"
        />
        <BrandScreenHeader
          description="Submit sponsor, gym or creator interest. A receipt is not approval, activation or a contract."
          eyebrow="SPONSORS + GYMS + CREATORS"
          title="PARTNER WITH GOGYMGO"
        />

        <View style={styles.optionList}>
          {partnerOptions.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.title}
                onPress={() => router.push(option.route)}
                style={({ pressed }) => pressed ? styles.pressed : null}
              >
                <HUDBorderBox style={styles.optionCard} tone="cyan">
                  <View style={styles.optionCopy}>
                    <TerminalText tone="cyan" variant="label">
                      {option.title}
                    </TerminalText>
                    <TerminalText tone="muted" uppercase={false} variant="body">
                      {option.body}
                    </TerminalText>
                  </View>
                  <TerminalText tone="cyan" variant="button">
                    {'→'}
                  </TerminalText>
                </HUDBorderBox>
              </Pressable>
          ))}
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  optionList: {
    gap: spacing.md,
    marginTop: spacing.xl
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg
  },
  optionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  pressed: {
    opacity: 0.74
  }
});
