import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { verifiedPartnerGymCatalogAvailable } from '@/config/partnerGyms';
import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
import { fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAppTour } from '@/state/appTour';
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
    available: heartRateTelemetryAvailable,
    body: 'Available after an approved heart-rate telemetry provider is connected.',
    method: 'heartRate',
    route: '/workout/check-in',
    title: 'HEART-RATE DEVICE'
  },
  {
    available: verifiedPartnerGymCatalogAvailable,
    body: 'Available after verified partner gyms and signed QR credentials are published.',
    method: 'partnerGymQr',
    route: '/qr-scanner',
    title: 'PARTNER GYM QR'
  }
];

export default function WorkoutMethodScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
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
        <OnboardingHeader
          label="WORKOUT SETUP"
          onBack={() => goBackOrReplace(router, '/session' as Href)}
          step="VERIFICATION"
        />
        <WorkoutFlowProgress stage="device" style={styles.workoutProgress} />
        <BrandScreenHeader
          description="Choose the verification method you will use to start, check, and finish this session."
          eyebrow="WORKOUT VERIFICATION"
          title="HOW WILL YOU CHECK IN?"
        />

        <View style={styles.optionList}>
          {orderedOptions.map((option) => {
            const available = option.available || appTourActive;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !available }}
                disabled={!available}
                key={option.title}
                onPress={() => void chooseMethod({ ...option, available })}
                style={({ pressed }) => [
                  styles.pressable,
                  !available ? styles.unavailable : null,
                  pressed ? styles.pressed : null
                ]}
              >
                <HUDBorderBox style={styles.optionCard} tone={available ? 'cyan' : 'muted'}>
                  <View style={styles.optionCopy}>
                    {option.method === preferredMethod ? (
                      <TerminalText tone="green" variant="micro">
                        {`${available ? 'YOUR DEFAULT' : 'SAVED PREFERENCE'} // ${preferredSourceLabel}`}
                      </TerminalText>
                    ) : null}
                    <TerminalText
                      style={styles.optionTitle}
                      tone={available ? 'cyan' : 'dim'}
                      variant="body"
                    >
                      {option.title}
                    </TerminalText>
                    {!available ? (
                      <TerminalText tone="dim" variant="micro">
                        NOT AVAILABLE
                      </TerminalText>
                    ) : null}
                    <TerminalText style={styles.optionBody} tone="muted" variant="body">
                      {option.body}
                    </TerminalText>
                  </View>
                  <TerminalText
                    tone={available ? 'cyan' : 'dim'}
                    variant="button"
                  >
                    {available ? '→' : 'Unavailable'}
                  </TerminalText>
                </HUDBorderBox>
              </Pressable>
            );
          })}
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

      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: brandScreenStyles.content,
  workoutProgress: {
    marginBottom: spacing.xl
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
