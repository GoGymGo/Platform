import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { AccountLegalAgreement } from '@/components/accountLegalAgreement';
import { AuthStatusNotice, AuthTextField } from '@/components/auth';
import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import {
  FirstRunPrimaryButton,
  FirstRunScreen,
  FirstRunSecondaryButton
} from '@/components/firstRun';
import { OnboardingHeader } from '@/components/onboarding';
import { getUserFacingErrorMessage } from '@/components/reliability';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useCreateRegionVerification } from '@/data/accountReadinessHooks';
import { submitRegionWaitlist } from '@/data/regionWaitlistRepository';
import { goBackOrReplace } from '@/navigation/goBack';
import { ApiError } from '@/services/api/client';
import { verifyCompetitionRegionWithDeviceLocation } from '@/services/competitionRegionVerification';
import { useAppTour } from '@/state/appTour';
import { useApi } from '@/state/api';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';

type VerificationState =
  | 'idle'
  | 'checking'
  | 'verified'
  | 'permission-denied'
  | 'location-unavailable'
  | 'service-error'
  | 'unsupported-region';

export default function RegionScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const { api } = useApi();
  const { user } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const {
    competitionRegion,
    regionVerification,
    verifyCompetitionRegion
  } = useCompetitionRegion();
  const createRegionVerification = useCreateRegionVerification();
  const [verificationState, setVerificationState] =
    useState<VerificationState>('idle');
  const [requestedRegion, setRequestedRegion] = useState('');
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const isProfileSource = source === 'profile';
  const isHomeSource = source === 'home';
  const isGymScanSource = source === 'gym-scan';
  const approvedRegionReady =
    regionVerification?.status === 'verified' &&
    Boolean(regionVerification.verificationId);
  const jurisdictionCode = regionVerification?.jurisdictionCode || 'GLOBAL';
  const permissionDeniedMessage =
    'LOCATION ACCESS WAS NOT ALLOWED. ENABLE LOCATION IN DEVICE SETTINGS, THEN TRY AGAIN.';

  async function checkDeviceLocation() {
    setVerificationState('checking');

    if (appTourActive) {
      try {
        const serverVerification = await createRegionVerification.mutateAsync({
          latitude: 43.6532,
          longitude: -79.3832,
          method: 'device_location'
        });
        await verifyCompetitionRegion(serverVerification);
        setVerificationState('verified');
        if (isProfileSource) {
          router.replace('/profile');
        }
      } catch {
        setVerificationState('service-error');
      }
      return;
    }

    const result = await verifyCompetitionRegionWithDeviceLocation();
    if (result.status !== 'location-read') {
      setVerificationState(result.status);
      return;
    }

    try {
      const serverVerification = await createRegionVerification.mutateAsync({
        ...result.coordinates,
        method: 'device_location'
      });
      await verifyCompetitionRegion(serverVerification);
      setVerificationState('verified');

      if (isProfileSource) {
        router.replace('/profile');
      }
    } catch (error) {
      setVerificationState(
        getApiErrorCode(error) === 'LOCATION_OUTSIDE_SUPPORTED_REGION'
          ? 'unsupported-region'
          : 'service-error'
      );
    }
  }

  async function joinRegionWaitlist() {
    if (!api || !user?.email || requestedRegion.trim().length < 2) {
      setWaitlistError('Enter the city or region where you want GoGymGo to launch.');
      return;
    }
    setWaitlistBusy(true);
    setWaitlistError(null);
    try {
      await submitRegionWaitlist(api, {
        email: user.email,
        requestedRegion: requestedRegion.trim()
      });
      setWaitlistJoined(true);
    } catch (error) {
      setWaitlistError(getUserFacingErrorMessage(
        error,
        'Your Regional updates request could not be saved. Check your connection and try again.'
      ));
    } finally {
      setWaitlistBusy(false);
    }
  }

  return (
    <FirstRunScreen>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label={isProfileSource ? 'CONTEST REGION' : 'REGION + AGREEMENTS'}
          onBack={() => goBackOrReplace(
            router,
            isProfileSource ? '/profile' : isHomeSource ? '/home' : '/join'
          )}
          progress={isProfileSource ? 100 : 50}
          step={isProfileSource ? 'PROFILE' : 'SETUP // 1 OF 2'}
        />

        <TerminalText style={styles.title} tone="text" variant="title">
          {isProfileSource
            ? 'REVERIFY YOUR REGION'
            : approvedRegionReady
              ? 'REGION VERIFIED'
              : 'VERIFY YOUR REGION'}
        </TerminalText>
        <TerminalText
          style={styles.body}
          tone="muted"
          uppercase={false}
          variant="body"
        >
          {approvedRegionReady && !isProfileSource
            ? `${competitionRegion.label} sets your contest, available rewards and local scoring time.`
            : 'Your verified location sets your regional contest, available rewards and local scoring time.'}
        </TerminalText>

        {!approvedRegionReady || isProfileSource ? (
          <HUDBorderBox style={styles.privacyCard} tone="cyan">
            <TerminalText tone="cyan" variant="label">
              ONE-TIME LOCATION CHECK
            </TerminalText>
            <TerminalText style={styles.bodyCopy} tone="muted" uppercase={false} variant="body">
              GoGymGo sends your location once for a secure region check. We
              save the approved region—not your coordinates—and never track you
              in the background.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        {isProfileSource && regionVerification ? (
          <HUDBorderBox style={styles.currentCard} tone="muted">
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <TerminalText tone="dim" variant="label">
                  CURRENT VERIFIED REGION
                </TerminalText>
                <TerminalText style={styles.bodyCopy} tone="text" variant="body">
                  {competitionRegion.label}
                </TerminalText>
              </View>
              <TerminalText tone="green" variant="label">
                VERIFIED
              </TerminalText>
            </View>
          </HUDBorderBox>
        ) : null}

        {!approvedRegionReady || isProfileSource ? (
          <FirstRunPrimaryButton
            disabled={verificationState === 'checking'}
            label={
              verificationState === 'checking'
                ? 'VERIFYING REGION...'
                : 'USE MY LOCATION ->'
            }
            onPress={() => void checkDeviceLocation()}
            style={styles.primaryAction}
          />
        ) : null}

        {verificationState === 'permission-denied' ? (
          <AuthStatusNotice
            message={permissionDeniedMessage}
            tone="amber"
          />
        ) : null}
        {verificationState === 'location-unavailable' ? (
          <AuthStatusNotice
            message="YOUR LOCATION COULD NOT BE READ. CHECK DEVICE LOCATION SERVICES AND TRY AGAIN."
            tone="amber"
          />
        ) : null}
        {verificationState === 'unsupported-region' ? (
          <HUDBorderBox style={styles.waitlistCard} tone="amber">
            <TerminalText tone="amber" variant="label">
              OUTSIDE THE SEPTEMBER PILOT REGION
            </TerminalText>
            <TerminalText style={styles.bodyCopy} tone="muted" uppercase={false} variant="body">
              The September pilot is available only on Vancouver Island and
              the supported Gulf Islands. We will not place you in Toronto or
              show another region&apos;s sample contest.
            </TerminalText>
            <CyberButtonOutline
              label="TRY LOCATION AGAIN"
              onPress={() => void checkDeviceLocation()}
            />
            {waitlistJoined ? (
              <TerminalText live="polite" tone="green" variant="label">
                REGIONAL UPDATES CONFIRMED
              </TerminalText>
            ) : (
              <>
                <AuthTextField
                  autoCapitalize="words"
                  label="YOUR CITY OR REGION"
                  onChangeText={(value) => {
                    setRequestedRegion(value);
                    setWaitlistError(null);
                  }}
                  placeholder="Example: Nanaimo, BC"
                  value={requestedRegion}
                />
                {waitlistError ? (
                  <AuthStatusNotice message={waitlistError} tone="red" />
                ) : null}
                <FirstRunPrimaryButton
                  disabled={waitlistBusy}
                  label={waitlistBusy ? 'SAVING REQUEST...' : 'GET REGIONAL UPDATES ->'}
                  onPress={() => void joinRegionWaitlist()}
                  tone="amber"
                />
              </>
            )}
          </HUDBorderBox>
        ) : null}
        {verificationState === 'service-error' ? (
          <AuthStatusNotice
            message="REGION VERIFICATION COULD NOT BE COMPLETED. CHECK YOUR CONNECTION AND TRY AGAIN."
            tone="red"
          />
        ) : null}

        {verificationState === 'permission-denied' ? (
          <FirstRunSecondaryButton
            label={Platform.OS === 'web' ? 'RETRY AFTER ALLOWING' : 'OPEN DEVICE SETTINGS'}
            onPress={() => {
              if (Platform.OS === 'web') {
                void checkDeviceLocation();
                return;
              }
              void Linking.openSettings();
            }}
          />
        ) : null}

        {approvedRegionReady ? (
          <HUDBorderBox style={styles.verifiedCard} tone="green">
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <TerminalText tone="green" variant="label">
                  VERIFIED REGION
                </TerminalText>
                <TerminalText tone="cyan" variant="title">
                  {competitionRegion.label}
                </TerminalText>
              </View>
              <TerminalText tone="green" variant="label">
                VERIFIED
              </TerminalText>
            </View>
            <TerminalText style={styles.captionCopy} tone="muted" uppercase={false} variant="caption">
              You will compete in {competitionRegion.label} and see rewards
              available for this region.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        {approvedRegionReady && !isProfileSource ? (
          <FirstRunSecondaryButton
            disabled={verificationState === 'checking'}
            label={
              verificationState === 'checking'
                ? 'REVERIFYING REGION...'
                : 'REVERIFY WITH MY LOCATION ->'
            }
            onPress={() => void checkDeviceLocation()}
          />
        ) : null}

        {approvedRegionReady && !isProfileSource ? (
          <AccountLegalAgreement
            jurisdictionCode={jurisdictionCode}
            onComplete={() => router.replace(
              isHomeSource
                ? '/commitment?source=home'
                : isGymScanSource
                  ? '/commitment?source=gym-scan'
                  : '/commitment'
            )}
          />
        ) : null}
      </ScreenScrollView>
    </FirstRunScreen>
  );
}

function getApiErrorCode(error: unknown) {
  if (
    !(error instanceof ApiError) ||
    !error.body ||
    typeof error.body !== 'object'
  ) {
    return null;
  }
  const body = error.body as {
    code?: unknown;
    error?: { code?: unknown };
  };
  if (typeof body.code === 'string') {
    return body.code;
  }
  return typeof body.error?.code === 'string' ? body.error.code : null;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  body: {
    marginBottom: spacing.sm,
    paddingLeft: 16,
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    lineHeight: 24
  },
  bodyCopy: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 23
  },
  captionCopy: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 21
  },
  privacyCard: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  currentCard: {
    padding: spacing.lg
  },
  primaryAction: {
    marginTop: spacing.sm
  },
  verifiedCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  waitlistCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  resultCopy: {
    flex: 1,
    gap: spacing.xs
  }
});
