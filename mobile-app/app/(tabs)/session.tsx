import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';

type SessionStartOption = {
  body: string;
  marker: string;
  route: Href;
  title: string;
  tone: 'cyan' | 'pink';
};

const sessionOptions: readonly SessionStartOption[] = [
  {
    body: 'USE YOUR LINKED WATCH, STRAP OR HEART-RATE SOURCE, THEN START THE 30-MINUTE TIMER.',
    marker: 'HEART',
    route: '/workout/check-in',
    title: 'HEART-RATE SESSION',
    tone: 'cyan'
  },
  {
    body: 'SCAN THE PARTNER-GYM ENTRY QR FIRST. FACE ID CONFIRMS IT IS YOU BEFORE THE SESSION STARTS.',
    marker: 'QR',
    route: '/qr-scanner',
    title: 'PARTNER GYM QR SESSION',
    tone: 'cyan'
  }
];

export default function SessionTabRoute() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            SESSION START
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            CHOOSE HOW TO VERIFY
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" variant="body">
            START WITH YOUR HEART-RATE DEVICE OR USE A PARTNER-GYM QR IF YOU
            ARE TRAINING AT A PARTICIPATING GYM.
          </TerminalText>
        </View>

        <View style={styles.optionList}>
          {sessionOptions.map((option) => (
            <SessionOptionCard key={option.title} option={option} />
          ))}
        </View>

        <HUDBorderBox style={styles.noteCard} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            ENTRY RULE
          </TerminalText>
          <TerminalText style={styles.noteCopy} tone="muted" variant="body">
            BOTH PATHS STILL REQUIRE CHECK-IN, MID-SESSION PRESENCE CHECKS AND
            CHECK-OUT BEFORE ENTRIES ARE BANKED.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonOutline
          label="BACK HOME"
          onPress={() => router.push('/home')}
          style={styles.backButton}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function SessionOptionCard({ option }: { option: SessionStartOption }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(option.route)}
      style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
    >
      <HUDBorderBox glow style={styles.optionCard} tone={option.tone}>
        <View style={styles.optionMarker}>
          <TerminalText glow tone={option.tone} variant="label">
            {option.marker}
          </TerminalText>
        </View>
        <View style={styles.optionCopy}>
          <TerminalText glow style={styles.optionTitle} tone={option.tone} variant="body">
            {option.title}
          </TerminalText>
          <TerminalText style={styles.optionBody} tone="muted" variant="body">
            {option.body}
          </TerminalText>
        </View>
        <TerminalText glow tone={option.tone} variant="button">
          -&gt;
        </TerminalText>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    marginBottom: spacing.xl
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal
  },
  optionList: {
    gap: spacing.md
  },
  pressableCard: {
    width: '100%'
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg
  },
  optionMarker: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceCyanSubtle,
    ...cyberGlow.cyan
  },
  optionCopy: {
    flex: 1
  },
  optionTitle: {
    fontFamily: fontFamilies.display
  },
  optionBody: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.terminal
  },
  noteCard: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  noteCopy: {
    fontFamily: fontFamilies.terminal
  },
  backButton: {
    marginTop: spacing.lg
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
