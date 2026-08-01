import { type Href, useRouter } from 'expo-router';
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

const partnerOptions = [
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
          Apply to sponsor a regional campaign or register a verified partner
          gym location.
        </TerminalText>

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
                    <TerminalText glow tone="cyan" variant="label">
                      {option.title}
                    </TerminalText>
                    <TerminalText tone="muted" uppercase={false} variant="body">
                      {option.body}
                    </TerminalText>
                  </View>
                  <TerminalText tone="cyan" variant="button">
                    {'->'}
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
