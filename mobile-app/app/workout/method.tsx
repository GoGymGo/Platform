import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import { useAuth } from '@/state/auth';
import {
  getVerificationPreference,
  savePreferredVerificationMethod,
  type PreferredVerificationMethod
} from '@/state/onboardingPreferences';

type VerificationOption = {
  body: string;
  method: PreferredVerificationMethod;
  route: Href;
  title: string;
};

const verificationOptions: readonly VerificationOption[] = [
  {
    body: 'USE YOUR LINKED WATCH, STRAP OR HEART-RATE SOURCE.',
    method: 'heartRate',
    route: '/workout/check-in',
    title: 'HEART-RATE DEVICE'
  },
  {
    body: 'SCAN IN AND OUT AT A PARTICIPATING PARTNER GYM.',
    method: 'partnerGymQr',
    route: '/qr-scanner',
    title: 'PARTNER GYM QR'
  }
];

export default function WorkoutMethodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [preferredMethod, setPreferredMethod] = useState<PreferredVerificationMethod>('heartRate');
  const [preferredSourceLabel, setPreferredSourceLabel] = useState('HEART-RATE DEVICE');
  const orderedOptions = useMemo(
    () => [...verificationOptions].sort(
      (left, right) =>
        Number(right.method === preferredMethod) - Number(left.method === preferredMethod)
    ),
    [preferredMethod]
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    void getVerificationPreference(user.uid).then((preference) => {
      setPreferredMethod(preference.method);
      setPreferredSourceLabel(preference.sourceLabel);
    });
  }, [user]);

  async function chooseMethod(option: VerificationOption) {
    setPreferredMethod(option.method);
    if (user) {
      await savePreferredVerificationMethod(user.uid, option.method);
    }
    router.push(option.route);
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            WORKOUT VERIFICATION
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            HOW WILL YOU CHECK IN?
          </TerminalText>
        </View>

        <View style={styles.optionList}>
          {orderedOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.title}
              onPress={() => void chooseMethod(option)}
              style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
            >
              <HUDBorderBox glow style={styles.optionCard} tone="cyan">
                <View style={styles.optionCopy}>
                  {option.method === preferredMethod ? (
                    <TerminalText glow tone="green" variant="micro">
                      YOUR DEFAULT // {preferredSourceLabel}
                    </TerminalText>
                  ) : null}
                  <TerminalText glow style={styles.optionTitle} tone="cyan" variant="body">
                    {option.title}
                  </TerminalText>
                  <TerminalText style={styles.optionBody} tone="muted" variant="body">
                    {option.body}
                  </TerminalText>
                </View>
                <TerminalText glow tone="cyan" variant="button">
                  -&gt;
                </TerminalText>
              </HUDBorderBox>
            </Pressable>
          ))}
        </View>

        <HUDBorderBox style={styles.noteCard} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            VERIFICATION RULE
          </TerminalText>
          <TerminalText style={styles.noteCopy} tone="muted" variant="body">
            YOUR DEFAULT METHOD APPEARS FIRST. BOTH METHODS REQUIRE CHECK-IN,
            A MID-SESSION IDENTITY CHECK AND CHECK-OUT BEFORE THE WORKOUT COUNTS.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonOutline
          label="BACK TO SESSION"
          onPress={() => router.replace('/session' as Href)}
          style={styles.backButton}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  optionList: {
    gap: spacing.md
  },
  pressable: {
    width: '100%'
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg
  },
  optionCopy: {
    flex: 1
  },
  optionTitle: {
    fontFamily: fontFamilies.display
  },
  optionBody: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  noteCard: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  noteCopy: {
    fontFamily: fontFamilies.body
  },
  backButton: {
    marginTop: spacing.lg
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
