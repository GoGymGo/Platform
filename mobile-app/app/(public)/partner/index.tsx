import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAuth } from '@/state/auth';
import { hasSubmittedCreatorApplication } from '@/state/onboardingPreferences';

const partnerOptions = [
  {
    body: 'Publish reviewed follow-along workouts for the GoGymGo community.',
    route: '/creator/apply?source=partner' as Href,
    title: 'APPLY AS A CREATOR'
  },
  {
    body: 'Fund a regional campaign and provide physical or digital rewards.',
    route: '/sponsor/apply' as Href,
    title: 'APPLY AS A SPONSOR'
  },
  {
    body: 'Request verified entry and exit QR codes for your gym location.',
    route: '/gym/register' as Href,
    title: 'REGISTER A PARTNER GYM'
  }
] as const;

export default function PartnerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [creatorSubmitted, setCreatorSubmitted] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    void hasSubmittedCreatorApplication(user.uid).then(setCreatorSubmitted);
  }, [user]);

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/profile')}
            style={styles.backButton}
          />
          <TerminalText glow tone="cyan" variant="label">
            PARTNER PORTAL
          </TerminalText>
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          PARTNER WITH GOGYMGO
        </TerminalText>
        <TerminalText style={styles.intro} tone="muted" uppercase={false} variant="body">
          Separate application paths for creators, campaign sponsors, and verified partner gyms.
        </TerminalText>

        <View style={styles.optionList}>
          {partnerOptions.map((option) => {
            const submitted = option.title === 'APPLY AS A CREATOR' && creatorSubmitted;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.title}
                onPress={() => router.push(option.route)}
                style={({ pressed }) => pressed ? styles.pressed : null}
              >
                <HUDBorderBox glow={submitted} style={styles.optionCard} tone={submitted ? 'green' : 'cyan'}>
                  <View style={styles.optionCopy}>
                    <TerminalText glow tone={submitted ? 'green' : 'cyan'} variant="label">
                      {option.title}
                    </TerminalText>
                    <TerminalText tone="muted" uppercase={false} variant="body">
                      {option.body}
                    </TerminalText>
                    {submitted ? (
                      <TerminalText tone="green" variant="micro">
                        APPLICATION SUBMITTED
                      </TerminalText>
                    ) : null}
                  </View>
                  <TerminalText tone={submitted ? 'green' : 'cyan'} variant="button">
                    -&gt;
                  </TerminalText>
                </HUDBorderBox>
              </Pressable>
            );
          })}
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  backButton: {
    width: 104
  },
  title: {
    marginTop: spacing.xxl,
    fontFamily: fontFamilies.display
  },
  intro: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body
  },
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
