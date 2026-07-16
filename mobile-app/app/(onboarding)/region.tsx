import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AuthStatusNotice, AuthTextField } from '@/components/auth';
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
import type {
  CompetitionRegion,
  CompetitionRegionVerificationMethod
} from '@/config/regions';
import { isLocalPreviewEnabled } from '@/config/firebase';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import {
  isCompleteCanadianPostalCode,
  normalizeCanadianPostalCode,
  resolveCompetitionRegionFromPostalCode
} from '@/domain/competitionRegionVerification';
import { goBackOrReplace } from '@/navigation/goBack';
import { verifyCompetitionRegionWithDeviceLocation } from '@/services/competitionRegionVerification';
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
  const { source } = useLocalSearchParams<{ source?: string }>();
  const {
    competitionRegion,
    regionVerification,
    verifyCompetitionRegion
  } = useCompetitionRegion();
  const regionPolicies = useRegionPolicies();
  const createRegionVerification = useCreateRegionVerification();
  const [candidateRegion, setCandidateRegion] = useState<CompetitionRegion | null>(null);
  const [verificationMethod, setVerificationMethod] =
    useState<CompetitionRegionVerificationMethod | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [postalCode, setPostalCode] = useState('');
  const [postalError, setPostalError] = useState('');
  const [showPostalFallback, setShowPostalFallback] = useState(false);
  const [deviceCoordinates, setDeviceCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const isProfileSource = source === 'profile';
  const candidateIsVerified = verificationMethod === 'device-location';

  async function checkDeviceLocation() {
    setPostalError('');
    setCandidateRegion(null);
    setVerificationMethod(null);
    setVerificationState('checking');

    const result = await verifyCompetitionRegionWithDeviceLocation();

    if (result.status === 'verified') {
      setDeviceCoordinates(result.coordinates);
      setCandidateRegion(result.region);
      setVerificationMethod('device-location');
      setVerificationState('verified');
      return;
    }

    setVerificationState(result.status);
    setShowPostalFallback(true);
  }

  function checkPostalCode() {
    const normalizedPostalCode = normalizeCanadianPostalCode(postalCode);
    setDeviceCoordinates(null);
    setPostalCode(normalizedPostalCode);

    if (!isCompleteCanadianPostalCode(normalizedPostalCode)) {
      setPostalError('ENTER A COMPLETE CANADIAN POSTAL CODE.');
      return;
    }

    const region = resolveCompetitionRegionFromPostalCode(normalizedPostalCode);

    if (!region) {
      if (isLocalPreviewEnabled) {
        setPostalError('');
        setCandidateRegion(competitionRegion);
        setVerificationMethod('postal-code');
        setVerificationState('verified');
        return;
      }

      setCandidateRegion(null);
      setVerificationMethod(null);
      setVerificationState('unsupported-region');
      setPostalError('GOGYMGO IS NOT ACTIVE IN THIS POSTAL AREA YET.');
      return;
    }

    setPostalError('');
    setCandidateRegion(region);
    setVerificationMethod('postal-code');
    setVerificationState('verified');
  }

  async function continueWithVerifiedRegion() {
    if (!candidateRegion || !verificationMethod) {
      return;
    }

    await submitRegionVerification(candidateRegion, verificationMethod);
  }

  async function continueWithPreviewRegion() {
    await submitRegionVerification(competitionRegion, 'postal-code');
  }

  async function submitRegionVerification(
    region: CompetitionRegion,
    method: CompetitionRegionVerificationMethod
  ) {
    const policy = regionPolicies.data?.find(
      ({ metroName }) => metroName.toUpperCase() === region.label.toUpperCase()
    );
    if (!policy) {
      setVerificationState('service-error');
      return;
    }

    setVerificationState('checking');
    try {
      const serverVerification = await createRegionVerification.mutateAsync({
        ...(method === 'device-location' && deviceCoordinates
          ? deviceCoordinates
          : {}),
        ...(method === 'postal-code' && postalCode ? { postalCode } : {}),
        method: method === 'device-location' ? 'device_location' : 'postal_code',
        regionPolicyId: policy.id
      });
      await verifyCompetitionRegion(region, method, {
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
      router.replace(isProfileSource ? '/profile' : '/consents');
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
          label={isProfileSource ? 'COMPETITION REGION' : 'REGION CHECK'}
          onBack={() => goBackOrReplace(
            router,
            isProfileSource ? '/profile' : '/identity'
          )}
          progress={isProfileSource ? 100 : 40}
          step={isProfileSource ? 'PROFILE' : 'STEP 02 / 05'}
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          {isProfileSource ? 'REVERIFY YOUR REGION' : 'VERIFY YOUR REGION'}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          YOUR VERIFIED LOCATION SETS YOUR REGIONAL COMPETITION, SPONSOR, PRIZE DRAW
          AND MONTHLY TIME ZONE.
        </TerminalText>

        <HUDBorderBox style={styles.privacyCard} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            ONE-TIME LOCATION CHECK
          </TerminalText>
          <TerminalText tone="muted" variant="body">
            GOGYMGO CHECKS YOUR LOCATION WHILE THIS SCREEN IS OPEN. WE SAVE YOUR
            VERIFIED REGION, NOT YOUR EXACT LOCATION, AND NEVER TRACK YOU IN THE
            BACKGROUND.
          </TerminalText>
        </HUDBorderBox>

        {isLocalPreviewEnabled ? (
          <HUDBorderBox style={styles.previewCard} tone="muted">
            <TerminalText tone="cyan" variant="label">
              FRONTEND PREVIEW
            </TerminalText>
            <TerminalText tone="muted" variant="body">
              LOCATION ELIGIBILITY IS BYPASSED WHILE YOU REVIEW THE UI. CONTINUE
              WITH {competitionRegion.label} DEMO DATA OR TEST THE LOCATION FLOW
              BELOW.
            </TerminalText>
            <CyberButtonOutline
              label={`CONTINUE WITH ${competitionRegion.label} DEMO ->`}
              onPress={() => void continueWithPreviewRegion()}
            />
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

        <CyberButtonPrimary
          disabled={verificationState === 'checking'}
          label={verificationState === 'checking' ? 'CHECKING LOCATION...' : 'USE MY LOCATION ->'}
          onPress={() => void checkDeviceLocation()}
          style={styles.primaryAction}
        />

        {verificationState === 'permission-denied' ? (
          <AuthStatusNotice
            message="LOCATION ACCESS WAS NOT ALLOWED. USE YOUR POSTAL CODE OR ENABLE LOCATION IN DEVICE SETTINGS."
            tone="amber"
          />
        ) : null}
        {verificationState === 'location-unavailable' ? (
          <AuthStatusNotice
            message="YOUR LOCATION COULD NOT BE READ. CHECK DEVICE LOCATION SERVICES, TRY AGAIN OR VERIFY WITH YOUR POSTAL CODE."
            tone="amber"
          />
        ) : null}
        {verificationState === 'unsupported-region' && !postalError ? (
          <AuthStatusNotice
            message="GOGYMGO IS NOT ACTIVE IN YOUR CURRENT REGION YET. VERIFY YOUR HOME POSTAL CODE TO CHECK ANOTHER ELIGIBLE AREA."
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

        <CyberButtonOutline
          label={showPostalFallback ? 'HIDE POSTAL CODE' : 'VERIFY WITH POSTAL CODE'}
          onPress={() => setShowPostalFallback((visible) => !visible)}
        />

        {showPostalFallback ? (
          <HUDBorderBox style={styles.postalCard} tone="muted">
            <TerminalText tone="cyan" variant="label">
              HOME POSTAL CODE
            </TerminalText>
            <TerminalText tone="muted" variant="caption">
              USE THIS IF LOCATION ACCESS IS UNAVAILABLE OR YOU ARE CURRENTLY TRAVELLING.
            </TerminalText>
            <AuthTextField
              autoCapitalize="characters"
              autoComplete="postal-code"
              error={isLocalPreviewEnabled && verificationState === 'unsupported-region' ? '' : postalError}
              label="CANADIAN POSTAL CODE"
              maxLength={7}
              onChangeText={(value) => {
                setPostalCode(normalizeCanadianPostalCode(value));
                setPostalError('');
              }}
              placeholder="A1A 1A1"
              returnKeyType="done"
              value={postalCode}
            />
            <CyberButtonOutline label="CHECK POSTAL CODE" onPress={checkPostalCode} />
          </HUDBorderBox>
        ) : null}

        {candidateRegion ? (
          <HUDBorderBox glow style={styles.verifiedCard} tone={candidateIsVerified ? 'green' : 'amber'}>
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <TerminalText tone={candidateIsVerified ? 'green' : 'amber'} variant="label">
                  REGION FOUND
                </TerminalText>
                <TerminalText glow tone="cyan" variant="title">
                  {candidateRegion.label}
                </TerminalText>
              </View>
              <TerminalText glow tone={candidateIsVerified ? 'green' : 'amber'} variant="label">
                {candidateIsVerified ? 'VERIFIED' : 'PROVISIONAL'}
              </TerminalText>
            </View>
            <TerminalText tone="muted" variant="caption">
              {candidateIsVerified
                ? `YOU WILL COMPETE IN ${candidateRegion.label} AND SEE SPONSOR CAMPAIGNS FOR THIS REGION.`
                : `YOUR POSTAL CODE MATCHES ${candidateRegion.label}. REVERIFY BY DEVICE LOCATION BEFORE COMPETITION ELIGIBILITY IS FINAL.`}
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <CyberButtonPrimary
          disabled={
            !candidateRegion ||
            !verificationMethod ||
            createRegionVerification.isPending ||
            regionPolicies.isLoading
          }
          label={createRegionVerification.isPending
            ? 'SUBMITTING REGION...'
            : isProfileSource
              ? 'SAVE VERIFIED REGION ->'
              : 'CONTINUE ->'}
          onPress={() => void continueWithVerifiedRegion()}
          style={styles.continueAction}
        />
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
  previewCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  currentCard: {
    padding: spacing.lg
  },
  primaryAction: {
    marginTop: spacing.sm
  },
  postalCard: {
    gap: spacing.md,
    padding: spacing.lg
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
  }
});
