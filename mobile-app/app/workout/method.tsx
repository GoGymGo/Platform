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
import { CompactTextButton } from '@/components/onboarding';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { verifiedPartnerGymCatalogAvailable } from '@/config/partnerGyms';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAuth } from '@/state/auth';
import {
  getVerificationPreference,
  getPreferenceOwnerId,
  savePreferredVerificationMethod,
  type PreferredVerificationMethod
} from '@/state/onboardingPreferences';

type VerificationOption = {
  available: boolean;
  body: string;
  method: PreferredVerificationMethod;
  route: Href;
  title: string;
};

const verificationOptions: readonly VerificationOption[] = [
  {
    available: true,
    body: 'Use your linked watch, strap, or heart-rate source.',
    method: 'heartRate',
    route: '/workout/check-in',
    title: 'HEART-RATE DEVICE'
  },
  {
    available: verifiedPartnerGymCatalogAvailable,
    body: 'No verified partner gyms are published yet. Use a heart-rate device for now.',
    method: 'partnerGymQr',
    route: '/qr-scanner',
    title: 'PARTNER GYM QR'
  }
];

export default function WorkoutMethodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const preferenceOwnerId = getPreferenceOwnerId(user?.uid);
  const [preferredMethod, setPreferredMethod] = useState<PreferredVerificationMethod>('heartRate');
  const [preferredSourceLabel, setPreferredSourceLabel] = useState('HEART-RATE DEVICE');
  const [showVerificationRules, setShowVerificationRules] = useState(false);
  const orderedOptions = useMemo(
    () =>
      [...verificationOptions].sort(
        (left, right) =>
          Number(right.method === preferredMethod) - Number(left.method === preferredMethod)
      ),
    [preferredMethod]
  );

  useEffect(() => {
    if (!preferenceOwnerId) {
      return;
    }

    void getVerificationPreference(preferenceOwnerId).then((preference) => {
      setPreferredMethod(preference.method);
      setPreferredSourceLabel(preference.sourceLabel);
    });
  }, [preferenceOwnerId]);

  async function chooseMethod(option: VerificationOption) {
    if (!option.available) {
      return;
    }

    setPreferredMethod(option.method);
    if (preferenceOwnerId) {
      await savePreferredVerificationMethod(preferenceOwnerId, option.method);
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
        <WorkoutFlowProgress stage="device" style={styles.workoutProgress} />
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
              accessibilityState={{ disabled: !option.available }}
              disabled={!option.available}
              key={option.title}
              onPress={() => void chooseMethod(option)}
              style={({ pressed }) => [
                styles.pressable,
                !option.available ? styles.unavailable : null,
                pressed ? styles.pressed : null
              ]}
            >
              <HUDBorderBox
                glow={option.available}
                style={styles.optionCard}
                tone={option.available ? 'cyan' : 'muted'}
              >
                <View style={styles.optionCopy}>
                  {option.method === preferredMethod ? (
                    <TerminalText glow tone="green" variant="micro">
                      YOUR DEFAULT // {preferredSourceLabel}
                    </TerminalText>
                  ) : null}
                  <TerminalText
                    glow={option.available}
                    style={styles.optionTitle}
                    tone={option.available ? 'cyan' : 'dim'}
                    variant="body"
                  >
                    {option.title}
                  </TerminalText>
                  {!option.available ? (
                    <TerminalText tone="dim" variant="micro">
                      NOT AVAILABLE
                    </TerminalText>
                  ) : null}
                  <TerminalText style={styles.optionBody} tone="muted" variant="body">
                    {option.body}
                  </TerminalText>
                </View>
                <TerminalText
                  glow={option.available}
                  tone={option.available ? 'cyan' : 'dim'}
                  variant="button"
                >
                  {option.available ? '->' : 'Unavailable'}
                </TerminalText>
              </HUDBorderBox>
            </Pressable>
          ))}
        </View>

        <CompactTextButton
          label={showVerificationRules ? 'Hide check-in details' : 'Why is this required?'}
          onPress={() => setShowVerificationRules((current) => !current)}
          tone={showVerificationRules ? 'muted' : 'cyan'}
        />
        {showVerificationRules ? (
          <HUDBorderBox style={styles.noteCard} tone="muted">
            <TerminalText style={styles.noteCopy} tone="muted" uppercase={false} variant="body">
              Every workout includes a start check, mid-workout verification and completion check.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <CyberButtonOutline
          label="BACK"
          onPress={() => goBackOrReplace(router, '/session' as Href)}
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
  workoutProgress: {
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
    marginTop: spacing.sm,
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
  },
  unavailable: {
    opacity: 0.7
  }
});
