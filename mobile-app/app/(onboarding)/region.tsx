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
import { SponsorRail } from '@/components/sponsor';
import type { CompetitionRegion } from '@/config/regions';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import {
  isCompleteCanadianPostalCode,
  normalizeCanadianPostalCode,
  resolveCompetitionRegionFromPostalCode
} from '@/domain/competitionRegionVerification';
import { goBackOrReplace } from '@/navigation/goBack';
import { verifyCompetitionRegionWithDeviceLocation } from '@/services/competitionRegionVerification';
import type { BcRegionEvidence } from '@/services/regionFoundation';
import { useCompetitionRegion } from '@/state/competitionRegion';

type VerificationState =
  | 'idle'
  | 'checking'
  | 'candidate-found'
  | 'permission-denied'
  | 'location-unavailable'
  | 'unsupported-region';

export default function RegionScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const {
    competitionRegion,
    refreshCompetitionRegionVerification,
    regionVerification,
    verifyCompetitionRegion
  } = useCompetitionRegion();
  const [candidateRegion, setCandidateRegion] = useState<CompetitionRegion | null>(null);
  const [candidateEvidence, setCandidateEvidence] =
    useState<BcRegionEvidence | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [postalCode, setPostalCode] = useState('');
  const [postalError, setPostalError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPostalFallback, setShowPostalFallback] = useState(false);
  const isProfileSource = source === 'profile';
  const reviewLocked =
    regionVerification?.status === 'approved' ||
    regionVerification?.status === 'pending';

  async function checkDeviceLocation() {
    setPostalError('');
    setSubmitError('');
    setCandidateRegion(null);
    setCandidateEvidence(null);
    setVerificationState('checking');

    const result = await verifyCompetitionRegionWithDeviceLocation();

    if (result.status === 'candidate-found') {
      setCandidateRegion(result.region);
      setCandidateEvidence({
        ...result.coordinates,
        method: 'device-location'
      });
      setVerificationState('candidate-found');
      return;
    }

    setVerificationState(result.status);
    setShowPostalFallback(true);
  }

  function checkPostalCode() {
    const normalizedPostalCode = normalizeCanadianPostalCode(postalCode);
    setPostalCode(normalizedPostalCode);

    if (!isCompleteCanadianPostalCode(normalizedPostalCode)) {
      setPostalError('ENTER A COMPLETE CANADIAN POSTAL CODE.');
      return;
    }

    const region = resolveCompetitionRegionFromPostalCode(normalizedPostalCode);

    if (!region) {
      setCandidateRegion(null);
      setCandidateEvidence(null);
      setVerificationState('unsupported-region');
      setPostalError('GOGYMGO IS NOT ACTIVE IN THIS POSTAL AREA YET.');
      return;
    }

    setPostalError('');
    setSubmitError('');
    setCandidateRegion(region);
    setCandidateEvidence({ method: 'postal-code', postalCode: normalizedPostalCode });
    setVerificationState('candidate-found');
  }

  async function submitRegionForReview() {
    if (!candidateRegion || !candidateEvidence || submitting) {
      return;
    }

    setSubmitError('');
    setSubmitting(true);
    try {
      await verifyCompetitionRegion(candidateRegion, candidateEvidence);
      setCandidateRegion(null);
      setCandidateEvidence(null);
      setVerificationState('idle');
    } catch {
      setSubmitError(
        'BC REGION REVIEW COULD NOT BE SUBMITTED. CHECK THE API AND TRY AGAIN.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReviewAction() {
    if (regionVerification?.status === 'approved') {
      router.replace(isProfileSource ? '/profile' : '/consents');
      return;
    }
    if (regionVerification?.status === 'pending') {
      setSubmitError('');
      setSubmitting(true);
      try {
        await refreshCompetitionRegionVerification();
      } catch {
        setSubmitError('REVIEW STATUS COULD NOT BE REFRESHED. TRY AGAIN.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    await submitRegionForReview();
  }

  return (
    <ScreenContainer>
      <SponsorRail compact />
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
          {isProfileSource ? 'RESUBMIT YOUR BC REGION' : 'CONFIRM YOUR BC REGION'}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          BRITISH COLUMBIA IS THE ONLY DEMO REGION. YOUR SUBMISSION SETS THE
          PACIFIC TIME ZONE, BUT THE SERVER MUST REVIEW ELIGIBILITY.
        </TerminalText>

        <HUDBorderBox style={styles.privacyCard} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            ONE-TIME LOCATION CHECK
          </TerminalText>
          <TerminalText tone="muted" variant="body">
            GOGYMGO CHECKS YOUR LOCATION WHILE THIS SCREEN IS OPEN. WE SAVE YOUR
            BC REGION SUBMISSION, NOT YOUR EXACT LOCATION, AND NEVER TRACK YOU
            IN THE BACKGROUND.
          </TerminalText>
        </HUDBorderBox>

        {regionVerification ? (
          <HUDBorderBox style={styles.currentCard} tone="muted">
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <TerminalText tone="dim" variant="label">
                  CURRENT REGION SUBMISSION
                </TerminalText>
                <TerminalText tone="text" variant="body">
                  {competitionRegion.label}
                </TerminalText>
              </View>
              <TerminalText tone="amber" variant="label">
                {regionVerification.status.toUpperCase()}
              </TerminalText>
            </View>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              {regionVerification.status === 'pending'
                ? 'An operator must approve this submission before demo enrollment is available.'
                : regionVerification.status === 'approved'
                  ? 'Your BC demo eligibility is approved. You may continue.'
                  : 'Submit a new BC check to continue with demo enrollment.'}
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <CyberButtonPrimary
          disabled={verificationState === 'checking' || reviewLocked}
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

        {submitError ? (
          <AuthStatusNotice message={submitError} tone="amber" />
        ) : null}

        {verificationState === 'permission-denied' ? (
          <CyberButtonOutline
            label="OPEN DEVICE SETTINGS"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}

        <CyberButtonOutline
          label={showPostalFallback ? 'HIDE POSTAL CODE' : 'VERIFY WITH POSTAL CODE'}
          disabled={reviewLocked}
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
              error={postalError}
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
          <HUDBorderBox glow style={styles.verifiedCard} tone="amber">
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <TerminalText tone="amber" variant="label">
                  BC CANDIDATE FOUND
                </TerminalText>
                <TerminalText glow tone="cyan" variant="title">
                  {candidateRegion.label}
                </TerminalText>
              </View>
              <TerminalText glow tone="amber" variant="label">
                READY TO SUBMIT
              </TerminalText>
            </View>
            <TerminalText tone="muted" variant="caption">
              {`THIS CHECK ONLY PREPARES A ${candidateRegion.label} REVIEW. IT DOES NOT ENROLL YOU, CREATE AN ENTRY OR ENABLE A PAYOUT.`}
            </TerminalText>
          </HUDBorderBox>
        ) : null}

        <CyberButtonPrimary
          disabled={
            submitting ||
            (!reviewLocked && (!candidateRegion || !candidateEvidence))
          }
          label={submitting
            ? 'CHECKING BC REVIEW...'
            : regionVerification?.status === 'approved'
              ? isProfileSource
                ? 'RETURN TO PROFILE ->'
                : 'CONTINUE WITH APPROVED BC REGION ->'
              : regionVerification?.status === 'pending'
                ? 'CHECK REVIEW STATUS'
                : 'SUBMIT BC REGION FOR REVIEW ->'}
          onPress={() => void handleReviewAction()}
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
