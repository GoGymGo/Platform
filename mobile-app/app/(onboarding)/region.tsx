import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AuthStatusNotice } from '@/components/auth';
import { AccountLegalAgreement } from '@/components/accountLegalAgreement';
import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import {
  useCreateRegionVerification,
  useRegionPolicies
} from '@/data/accountReadinessHooks';
import type { CompetitionRegion } from '@/config/regions';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import type { RegionCoordinates } from '@/domain/competitionRegionVerification';
import { goBackOrReplace } from '@/navigation/goBack';
import { verifyCompetitionRegionWithDeviceLocation } from '@/services/competitionRegionVerification';
import { useAppTour } from '@/state/appTour';
import { useCompetitionRegion } from '@/state/competitionRegion';

type VerificationState =
  | 'idle'
  | 'checking'
  | 'verified'
  | 'permission-denied'
  | 'location-unavailable'
  | 'review-pending'
  | 'service-error'
  | 'unsupported-region';

export default function RegionScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const {
    competitionRegion,
    regionVerification,
    verifyCompetitionRegion
  } = useCompetitionRegion();
  const regionPolicies = useRegionPolicies();
  const createRegionVerification = useCreateRegionVerification();
  const [candidateRegion, setCandidateRegion] = useState<CompetitionRegion | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [deviceCoordinates, setDeviceCoordinates] =
    useState<RegionCoordinates | null>(null);
  const isProfileSource = source === 'profile';
  const isHomeSource = source === 'home';
  const approvedRegionReady =
    regionVerification?.status === 'verified' &&
    Boolean(regionVerification.verificationId);
  const jurisdictionCode =
    regionVerification?.regionCode?.split('-').slice(0, 2).join('-') ||
    'GLOBAL';
  const visibleRegion =
    candidateRegion ?? (approvedRegionReady ? competitionRegion : null);

  async function checkDeviceLocation() {
    setCandidateRegion(null);
    setDeviceCoordinates(null);
    setVerificationState('checking');

    if (appTourActive) {
      setDeviceCoordinates({
        latitude: 43.6532,
        longitude: -79.3832
      });
      setCandidateRegion(competitionRegion);
      setVerificationState('verified');
      return;
    }

    const result = await verifyCompetitionRegionWithDeviceLocation();

    if (result.status === 'verified') {
      setDeviceCoordinates(result.coordinates);
      setCandidateRegion(result.region);
      setVerificationState('verified');
      return;
    }

    setVerificationState(result.status);
  }

  async function continueWithVerifiedRegion() {
    if (!candidateRegion || !deviceCoordinates) {
      return;
    }

    await submitRegionVerification(candidateRegion, deviceCoordinates);
  }

  async function submitRegionVerification(
    region: CompetitionRegion,
    coordinates: RegionCoordinates
  ) {
    const availablePolicies = regionPolicies.data ?? (await regionPolicies.refetch()).data;
    const policy = availablePolicies?.find(
      ({ metroName }) => metroName.toUpperCase() === region.label.toUpperCase()
    );
    if (!policy) {
      setVerificationState('service-error');
      return;
    }

    setVerificationState('checking');
    try {
      const serverVerification = await createRegionVerification.mutateAsync({
        ...coordinates,
        method: 'device_location',
        regionPolicyId: policy.id
      });
      await verifyCompetitionRegion(region, 'device-location', {
        id: serverVerification.id,
        regionCode: serverVerification.regionCode ?? policy.code,
        regionPolicyId: serverVerification.regionPolicyId,
        status: serverVerification.status
      });

      if (serverVerification.status !== 'approved') {
        setVerificationState('review-pending');
        return;
      }

      setVerificationState('verified');
      if (isProfileSource) {
        router.replace('/profile');
      }
    } catch {
      setVerificationState('service-error');
    }
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label={isProfileSource ? 'COMPETITION REGION' : 'REGION + AGREEMENTS'}
          onBack={() => goBackOrReplace(
            router,
            isProfileSource ? '/profile' : isHomeSource ? '/home' : '/join'
          )}
          progress={isProfileSource ? 100 : 50}
          step={isProfileSource ? 'PROFILE' : 'SETUP // 1 OF 2'}
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          {isProfileSource
            ? 'REVERIFY YOUR REGION'
            : approvedRegionReady
              ? 'REGION VERIFIED'
              : 'VERIFY YOUR REGION'}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          {approvedRegionReady && !isProfileSource
            ? `${competitionRegion.label} sets your competition, available rewards and local scoring time.`
            : 'Your verified location sets your regional competition, available rewards and local scoring time.'}
        </TerminalText>

        {!approvedRegionReady || isProfileSource ? (
          <HUDBorderBox style={styles.privacyCard} tone="cyan">
            <TerminalText tone="cyan" variant="label">
              ONE-TIME LOCATION CHECK
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
            GoGymGo checks your location only while this screen is open. We save
            your verified region—not your exact location—and never track you in
            the background.
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
                <TerminalText tone="text" variant="body">
                  {competitionRegion.label}
                </TerminalText>
              </View>
              <TerminalText tone={regionVerification.status === 'verified' ? 'green' : 'amber'} variant="label">
                {regionVerification.status === 'verified' ? 'VERIFIED' : 'PROVISIONAL'}
              </TerminalText>
            </View>
          </HUDBorderBox>
        ) : null}

        {!approvedRegionReady || isProfileSource ? (
          <CyberButtonPrimary
            disabled={verificationState === 'checking'}
            label={verificationState === 'checking' ? 'CHECKING LOCATION...' : 'USE MY LOCATION ->'}
            onPress={() => void checkDeviceLocation()}
            style={styles.primaryAction}
          />
        ) : null}

        {verificationState === 'permission-denied' ? (
          <AuthStatusNotice
            message="LOCATION ACCESS WAS NOT ALLOWED. ENABLE LOCATION IN DEVICE SETTINGS, THEN TRY AGAIN."
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
          <AuthStatusNotice
            message="GOGYMGO IS NOT ACTIVE IN YOUR CURRENT REGION YET."
            tone="amber"
          />
        ) : null}
        {verificationState === 'review-pending' ? (
          <AuthStatusNotice
            message="YOUR REGION CHECK WAS SUBMITTED FOR REVIEW. RETURN HERE AFTER APPROVAL TO CONTINUE COMPETITION REGISTRATION."
            tone="amber"
          />
        ) : null}
        {verificationState === 'service-error' || regionPolicies.isError ? (
          <AuthStatusNotice
            message="REGION VERIFICATION COULD NOT BE COMPLETED. CHECK YOUR CONNECTION AND TRY AGAIN."
            tone="red"
          />
        ) : null}

        {verificationState === 'permission-denied' ? (
          <CyberButtonOutline
            label="OPEN DEVICE SETTINGS"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}

        {visibleRegion ? (
          <HUDBorderBox glow style={styles.verifiedCard} tone="green">
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <TerminalText tone="green" variant="label">
                  VERIFIED REGION
                </TerminalText>
                <TerminalText glow tone="cyan" variant="title">
                  {visibleRegion.label}
                </TerminalText>
              </View>
              <TerminalText glow tone="green" variant="label">
                VERIFIED
              </TerminalText>
            </View>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              You will compete in {visibleRegion.label} and see rewards available
              for this region.
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        {!approvedRegionReady || isProfileSource ? (
          <CyberButtonPrimary
            disabled={
              !candidateRegion ||
              !deviceCoordinates ||
              createRegionVerification.isPending ||
              regionPolicies.isLoading
            }
            label={createRegionVerification.isPending
              ? 'SAVING REGION...'
              : isProfileSource
                ? 'SAVE VERIFIED REGION ->'
                : 'CONFIRM REGION ->'}
            onPress={() => void continueWithVerifiedRegion()}
            style={styles.continueAction}
          />
        ) : null}
        {!approvedRegionReady && !candidateRegion && verificationState === 'idle' ? (
          <TerminalText style={styles.continueHelper} tone="dim" uppercase={false} variant="caption">
            Confirm Region unlocks after your location is found.
          </TerminalText>
        ) : null}

        {approvedRegionReady && !isProfileSource ? (
          <AccountLegalAgreement
            jurisdictionCode={jurisdictionCode}
            onComplete={() => router.replace(
              isHomeSource ? '/commitment?source=home' : '/commitment'
            )}
          />
        ) : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
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
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  resultCopy: {
    flex: 1,
    gap: spacing.xs
  },
  continueAction: {
    marginTop: spacing.sm
  },
  continueHelper: {
    paddingHorizontal: spacing.md,
    textAlign: 'center'
  }
});
