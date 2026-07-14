import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { SponsorRail } from '@/components/sponsor';
import {
  colors,
  fontFamilies,
  fontSizes,
  interactionStates,
  radii,
  spacing
} from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAuth } from '@/state/auth';
import {
  getVerificationPreference,
  saveVerificationPreference,
  type PreferredVerificationMethod
} from '@/state/onboardingPreferences';

type VerificationOption = {
  detail: string;
  method: PreferredVerificationMethod;
  sourceKey: string;
  title: string;
};

const verificationOptions: readonly VerificationOption[] = [
  {
    detail: 'Connect an eligible heart-rate source during workout setup.',
    method: 'heartRate',
    sourceKey: 'heartRateDevice',
    title: 'HEART-RATE DEVICE'
  },
  {
    detail: 'Scan signed entry and exit codes at a participating partner gym.',
    method: 'partnerGymQr',
    sourceKey: 'partnerGymQr',
    title: 'PARTNER GYM QR'
  }
] as const;

export default function VerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [loadedPreferenceUserId, setLoadedPreferenceUserId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] =
    useState<PreferredVerificationMethod>('heartRate');
  const preferenceReady = !user || loadedPreferenceUserId === user.uid;

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let cancelled = false;

    void getVerificationPreference(user.uid).then((preference) => {
      if (!cancelled) {
        setSelectedMethod(preference.method);
        setLoadedPreferenceUserId(user.uid);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function continueWithVerificationMethod() {
    if (!user || !preferenceReady) {
      return;
    }

    const selected = verificationOptions.find(
      (option) => option.method === selectedMethod
    );

    if (!selected) {
      return;
    }

    await saveVerificationPreference(user.uid, {
      method: selected.method,
      sourceKey: selected.sourceKey,
      sourceLabel: selected.title
    });
    router.replace(source === 'profile' ? '/profile' : '/commitment');
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
          label={source === 'profile' ? 'EDIT VERIFICATION' : 'VERIFICATION'}
          onBack={() => goBackOrReplace(
            router,
            source === 'profile' ? '/profile' : '/consents'
          )}
          progress={source === 'profile' ? 100 : 80}
          step={source === 'profile' ? 'PROFILE' : 'STEP 04 / 05'}
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          HOW WILL YOU VERIFY WORKOUTS?
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Choose your preferred verification method. Availability and eligibility
          are confirmed when a real session is created.
        </TerminalText>

        <View accessibilityRole="radiogroup" style={styles.optionList}>
          {verificationOptions.map((option) => {
            const selected = option.method === selectedMethod;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.method}
                onPress={() => setSelectedMethod(option.method)}
                style={({ pressed }) => [
                  styles.optionPressable,
                  pressed ? styles.pressed : null
                ]}
              >
                <HUDBorderBox
                  glow={selected}
                  style={styles.optionCard}
                  tone={selected ? 'cyan' : 'muted'}
                >
                  <View style={styles.optionCopy}>
                    <TerminalText
                      glow={selected}
                      style={styles.optionTitle}
                      tone={selected ? 'cyan' : 'text'}
                      variant="body"
                    >
                      {option.title}
                    </TerminalText>
                    <TerminalText tone="muted" uppercase={false} variant="body">
                      {option.detail}
                    </TerminalText>
                  </View>
                  <TerminalText tone={selected ? 'cyan' : 'dim'} variant="micro">
                    {selected ? 'SELECTED' : 'SELECT'}
                  </TerminalText>
                </HUDBorderBox>
              </Pressable>
            );
          })}
        </View>

        <HUDBorderBox style={styles.integrationNotice} tone="amber">
          <TerminalText glow tone="amber" variant="label">
            CONNECTION REQUIRED AT CHECK-IN
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Choosing a preference does not verify a workout. GoGymGo accepts a
            session only after the configured device or partner-gym integration
            supplies verifiable evidence.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonPrimary
          disabled={!user || !preferenceReady}
          label={preferenceReady ? 'SAVE VERIFICATION METHOD ->' : 'LOADING...'}
          onPress={continueWithVerificationMethod}
          style={styles.action}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  optionList: {
    gap: spacing.md,
    marginTop: spacing.xl
  },
  optionPressable: {
    borderRadius: radii.lg,
    ...interactionStates.webFocus
  },
  optionCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg
  },
  optionCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  optionTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  integrationNotice: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  action: {
    marginTop: spacing.xl
  },
  pressed: {
    ...interactionStates.pressed
  }
});
