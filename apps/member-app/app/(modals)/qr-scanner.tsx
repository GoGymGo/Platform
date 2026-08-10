import type { GymScanResultDto } from '@gogymgo/contracts';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { getUserFacingErrorMessage, RecoverableScreenError } from '@/components/reliability';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { SessionUnavailable } from '@/components/session';
import { AppTourQrSimulator } from '@/testing/AppTourQrSimulator';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { gymLocationAccuracyWarning } from '@/constants/gymScan';
import { createGymScanRepository } from '@/data/gymScanRepository';
import {
  extractGymScanCredential,
  getGymScanRemainingSeconds,
  isGymLocationAccuracyValidationMessage,
  isGymScanCompletionReady
} from '@/domain/gymScan';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { getGymScanSetupRoute } from '@/navigation/gymScanFlow';
import { ApiError } from '@/services/api/client';
import { readGymScanLocation } from '@/services/gymScanLocation';
import {
  readPendingGymScan,
  rememberGymScanCredential,
  rememberGymScanResult,
  type PendingGymScan
} from '@/services/pendingGymScan';
import { useApi } from '@/state/api';
import { useAppTour } from '@/state/appTour';

type ScanUiState = 'ready' | 'locating' | 'submitting' | 'result';

export default function QrScannerModal() {
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (!mobileGymVerificationAvailable) {
    return <Redirect href="/home" />;
  }

  return <MobileQrScannerModal />;
}

function MobileQrScannerModal() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const {
    credential: linkedCredential,
    enrollment,
    posterScan
  } = useLocalSearchParams<{
    credential?: string;
    enrollment?: string;
    posterScan?: string;
  }>();
  const enrollmentPresenceMode = enrollment === '1';
  const posterScanReady = posterScan === '1' || Boolean(linkedCredential);
  const { api, configured } = useApi();
  const repository = useMemo(() => (api ? createGymScanRepository(api) : null), [api]);
  const [pendingIntent, setPendingIntent] = useState<PendingGymScan | null>(null);
  const [pendingIntentLoading, setPendingIntentLoading] = useState(true);
  const linkedCredentialValue = extractGymScanCredential(linkedCredential ?? '');
  const effectiveCredential = linkedCredentialValue ?? pendingIntent?.credential ?? null;
  const {
    checking: registrationChecking,
    currentCompetition: scannedCompetition,
    error: registrationError,
    ready: registrationReady,
    retry: retryRegistration,
    retrying: registrationRetrying,
    setupActionLabel,
    setupMessage,
    setupStep
  } = useSessionRegistrationAccess({
    gymQrCredential: enrollmentPresenceMode ? null : effectiveCredential,
    gymQrScanKey: enrollmentPresenceMode ? null : (pendingIntent?.createdAt ?? null)
  });
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRequested, setCameraRequested] = useState(false);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [requirePhysicalRescan, setRequirePhysicalRescan] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [state, setState] = useState<ScanUiState>('ready');
  const [result, setResult] = useState<GymScanResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeSession = pendingIntent?.activeSession ?? null;
  const timerTarget =
    result?.outcome === 'started' || result?.outcome === 'too_early'
      ? result.minimumCompleteAt
      : activeSession?.minimumCompleteAt;
  const resultRemainingSeconds = result ? result.remainingSeconds : 0;
  const displayRemainingSeconds = getGymScanRemainingSeconds(
    timerTarget,
    resultRemainingSeconds,
    clockNow
  );
  const completionReady =
    clockNow !== null &&
    isGymScanCompletionReady(timerTarget, clockNow) &&
    Boolean(activeSession || result?.outcome === 'started' || result?.outcome === 'too_early');
  const scannedContestAcceptsWorkouts = scannedCompetition?.status === 'active';

  useEffect(() => {
    let active = true;

    async function hydratePendingIntent() {
      try {
        const pending = linkedCredentialValue
          ? await rememberGymScanCredential(linkedCredentialValue)
          : await readPendingGymScan();
        if (active) {
          setPendingIntent(pending);
        }
      } finally {
        if (active) {
          setPendingIntentLoading(false);
        }
      }
    }

    void hydratePendingIntent();
    return () => {
      active = false;
    };
  }, [linkedCredentialValue]);

  useEffect(() => {
    if (!timerTarget) {
      return;
    }

    const initialTick = setTimeout(() => setClockNow(Date.now()), 0);
    const interval = setInterval(() => setClockNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialTick);
      clearInterval(interval);
    };
  }, [timerTarget]);

  const submitCredential = useCallback(
    async (rawPayload: string) => {
      if (scanLocked || (!repository && !enrollmentPresenceMode)) return;
      const credential = extractGymScanCredential(rawPayload);
      if (!credential) {
        setScanLocked(true);
        setError('That code is not a valid GoGymGo gym QR. Check the poster and scan again.');
        return;
      }
      setScanLocked(true);
      setError(null);
      setResult(null);
      setState('locating');
      try {
        setPendingIntent(await rememberGymScanCredential(credential));
      } catch {
        if (enrollmentPresenceMode) {
          setState('result');
          setError('The gym QR could not be saved. Check device storage and scan again.');
          return;
        }
        // A storage failure must not replace an authoritative workout scan result.
      }
      if (enrollmentPresenceMode) {
        router.replace('/commitment?source=gym-scan');
        return;
      }
      if (!repository) return;
      const location = await readGymScanLocation();
      if (location.status !== 'location-read') {
        setState('result');
        setError(
          location.status === 'permission-denied'
              ? 'Location access was not allowed. Enable location in device settings, then try again.'
              : 'Your live location could not be read. Check location services and try again.'
        );
        return;
      }
      setState('submitting');
      try {
        const scanResult = await repository.scan({
          accuracyMeters: location.accuracyMeters,
          credential,
          eventId: randomUUID(),
          latitude: location.latitude,
          longitude: location.longitude
        });
        setResult(scanResult);
        if (scanResult.outcome === 'started' || scanResult.outcome === 'too_early') {
          setRequirePhysicalRescan(true);
        } else if (scanResult.outcome === 'verified') {
          setRequirePhysicalRescan(false);
        }
        try {
          setPendingIntent(await rememberGymScanResult(credential, scanResult));
        } catch {
          // The server response remains authoritative if local continuity storage fails.
        }
      } catch (scanError) {
        setError(getScanErrorMessage(scanError));
      } finally {
        setState('result');
      }
    },
    [enrollmentPresenceMode, repository, router, scanLocked]
  );

  function handleBarcodeScanned(scan: BarcodeScanningResult) {
    void submitCredential(scan.data);
  }

  function scanAgain() {
    setScanLocked(false);
    setState('ready');
    setResult(null);
    setError(null);
  }

  function openFinishScanner() {
    setCameraRequested(true);
    setError(null);
    setRequirePhysicalRescan(true);
    setResult(null);
    setScanLocked(false);
    setState('ready');
  }

  if (pendingIntentLoading) {
    return (
      <ScreenLoadingState
        body={
          enrollmentPresenceMode
            ? 'Preparing gym location confirmation.'
            : 'Preparing your gym workout.'
        }
      />
    );
  }
  if (!enrollmentPresenceMode && registrationChecking) {
    return <ScreenLoadingState body="Checking your contest registration." />;
  }
  if (!enrollmentPresenceMode && registrationError) {
    return (
      <RecoverableScreenError
        body="Your contest setup could not be checked. Retry before scanning the gym poster."
        onRetry={() => void retryRegistration()}
        retrying={registrationRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }
  if (!enrollmentPresenceMode && !registrationReady) {
    return (
      <SessionUnavailable
        actionLabel={setupActionLabel}
        body={setupMessage}
        onAction={() => {
          const setupRoute = getGymScanSetupRoute(setupStep);
          if (setupRoute) router.replace(setupRoute);
        }}
        title="FINISH SETUP"
      />
    );
  }
  if (
    !enrollmentPresenceMode &&
    effectiveCredential &&
    scannedCompetition &&
    !scannedContestAcceptsWorkouts
  ) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO HOME"
        body={`You are registered for ${scannedCompetition.name}. Workout scans open when this contest begins on ${new Intl.DateTimeFormat(
          'en-CA',
          { day: 'numeric', month: 'long', year: 'numeric' }
        ).format(new Date(scannedCompetition.startsAt))}.`}
        onAction={() => router.replace('/home')}
        title="REGISTRATION COMPLETE"
      />
    );
  }
  if ((!configured || !repository) && !appTourActive && !enrollmentPresenceMode) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO TRAINING"
        body="The secure scan service is temporarily unavailable. Your account and contest data are safe."
        onAction={() => router.replace('/session')}
        title="QR SERVICE OFFLINE"
      />
    );
  }

  const busy = state === 'locating' || state === 'submitting';
  const resultTone = completionReady
    ? 'green'
    : result?.outcome === 'verified'
      ? 'green'
      : result?.outcome === 'started'
        ? 'cyan'
        : result?.outcome === 'too_early'
          ? 'amber'
          : 'red';

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="PARTNER GYM QR"
          onBack={() =>
            goBackOrReplace(router, enrollmentPresenceMode ? '/commitment' : '/session')
          }
          step={enrollmentPresenceMode ? 'CONTEST ENROLLMENT' : 'VERIFICATION'}
        />
        <BrandScreenHeader
          description={
            enrollmentPresenceMode
              ? 'Scan the active GoGymGo QR poster at this Partner gym, then confirm enrollment while you are still at the gym.'
              : 'Scan the gym poster once to start, then scan the same poster after the server timer to finish.'
          }
          eyebrow={enrollmentPresenceMode ? 'GYM LOCATION' : 'VERIFIED GYM WORKOUT'}
          title={
            enrollmentPresenceMode
              ? "SCAN THIS GYM'S QR"
              : completionReady
                ? 'READY TO FINISH'
                : activeSession || result?.outcome === 'started' || result?.outcome === 'too_early'
                  ? 'WORKOUT IN PROGRESS'
                  : 'START OR FINISH YOUR WORKOUT'
          }
        />

        <HUDBorderBox style={styles.instructions} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            {enrollmentPresenceMode ? 'ACTIVE QR // WITHIN 75 METRES' : 'ONE POSTER // TWO SCANS'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            {enrollmentPresenceMode
              ? 'After this scan, you will return to registration. Confirm while you are still within 75 metres; GoGymGo will request a fresh location reading then.'
              : 'Scan once at the gym, then choose Start Workout. After the server timer reaches 00:00, scan the same poster again and choose Finish Workout. Your location is checked only when you submit each scan.'}
          </TerminalText>
        </HUDBorderBox>

        {busy ? (
          <HUDBorderBox glow style={styles.stateCard} tone="cyan">
            <TerminalText live="polite" glow tone="cyan" variant="label">
              {state === 'locating' ? 'READING LIVE LOCATION...' : 'VERIFYING WITH SERVER...'}
            </TerminalText>
          </HUDBorderBox>
        ) : result || error ? (
          <HUDBorderBox glow style={styles.stateCard} tone={error ? 'red' : resultTone}>
            <TerminalText glow tone={error ? 'red' : resultTone} variant="label">
              {error
                ? 'SCAN NOT COMPLETED'
                : completionReady
                  ? '30 MINUTES COMPLETE'
                  : resultTitle(result!)}
            </TerminalText>
            <TerminalText
              live={error || result?.outcome === 'rejected' ? 'assertive' : 'polite'}
              tone="muted"
              uppercase={false}
              variant="body"
            >
              {error ??
                (completionReady
                  ? 'Return to the same gym poster and scan it again to finish and verify your workout.'
                  : resultMessage(result!))}
            </TerminalText>
            {result?.gymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {result.gymName}
              </TerminalText>
            ) : null}
            {result?.outcome === 'started' || result?.outcome === 'too_early' ? (
              <TerminalText glow style={styles.remaining} tone="pink" variant="display">
                {completionReady ? 'READY' : formatRemaining(displayRemainingSeconds)}
              </TerminalText>
            ) : null}
            {error?.startsWith('Location access') ? (
              <CyberButtonOutline
                label={
                  Platform.OS === 'web' ? 'TRY AFTER ALLOWING LOCATION' : 'OPEN DEVICE SETTINGS'
                }
                onPress={() => {
                  if (Platform.OS === 'web') {
                    scanAgain();
                  } else {
                    void Linking.openSettings();
                  }
                }}
                tone="amber"
              />
            ) : null}
            {completionReady ? (
              <CyberButtonPrimary label="OPEN SCANNER TO FINISH" onPress={openFinishScanner} />
            ) : null}
            <CyberButtonOutline
              label={
                error
                  ? 'TRY AGAIN'
                  : result?.outcome === 'verified'
                    ? 'BACK TO TRAINING'
                    : 'CLOSE FOR NOW'
              }
              onPress={() => {
                if (error) {
                  scanAgain();
                } else {
                  goBackOrReplace(router, '/session');
                }
              }}
            />
          </HUDBorderBox>
        ) : !enrollmentPresenceMode &&
          posterScanReady &&
          effectiveCredential &&
          !scanLocked &&
          !requirePhysicalRescan ? (
          <HUDBorderBox glow style={styles.stateCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              {activeSession ? 'RETURN SCAN READY' : 'ENTRY SCAN READY'}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {activeSession
                ? 'Choose Finish Workout to check your location and complete this active gym session.'
                : 'Choose Start Workout to check your location and begin the authoritative server timer.'}
            </TerminalText>
            {activeSession?.gymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {activeSession.gymName}
              </TerminalText>
            ) : null}
            {activeSession ? (
              <TerminalText glow style={styles.remaining} tone="pink" variant="display">
                {formatRemaining(displayRemainingSeconds)}
              </TerminalText>
            ) : null}
            <CyberButtonPrimary
              label={activeSession ? 'FINISH WORKOUT' : 'START WORKOUT'}
              onPress={() => void submitCredential(effectiveCredential)}
            />
          </HUDBorderBox>
        ) : !enrollmentPresenceMode && activeSession && !cameraRequested ? (
          <HUDBorderBox glow style={styles.stateCard} tone={completionReady ? 'green' : 'cyan'}>
            <TerminalText glow tone={completionReady ? 'green' : 'cyan'} variant="label">
              {completionReady ? '30 MINUTES COMPLETE' : 'WORKOUT TIMER ACTIVE'}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {completionReady
                ? 'Return to the same gym poster and scan it again to finish and verify your workout.'
                : 'When the timer reaches 00:00, scan the same gym poster again to verify your workout day.'}
            </TerminalText>
            {activeSession.gymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {activeSession.gymName}
              </TerminalText>
            ) : null}
            <TerminalText glow style={styles.remaining} tone="pink" variant="display">
              {completionReady ? 'READY' : formatRemaining(displayRemainingSeconds)}
            </TerminalText>
            <CyberButtonPrimary
              label="SCAN POSTER TO FINISH"
              onPress={() => setCameraRequested(true)}
            />
          </HUDBorderBox>
        ) : appTourActive ? (
          <AppTourQrSimulator
            onConfirm={(payload) => void submitCredential(payload)}
            scanLocked={scanLocked}
            scanMode={activeSession ? 'exit' : 'entry'}
            style={styles.stateCard}
          />
        ) : !permission ? (
          <HUDBorderBox style={styles.stateCard} tone="muted">
            <TerminalText live="polite" tone="muted" variant="label">
              CHECKING CAMERA PERMISSION
            </TerminalText>
          </HUDBorderBox>
        ) : !permission.granted ? (
          <HUDBorderBox style={styles.stateCard} tone="amber">
            <TerminalText glow tone="amber" variant="label">
              CAMERA ACCESS REQUIRED
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Camera frames are processed on this device only and are never stored.
            </TerminalText>
            <CyberButtonPrimary
              label={permission.canAskAgain ? 'ALLOW CAMERA' : 'OPEN SETTINGS'}
              onPress={() =>
                void (permission.canAskAgain ? requestPermission() : Linking.openSettings())
              }
              tone="amber"
            />
          </HUDBorderBox>
        ) : (
          <View style={styles.cameraShell}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
              style={styles.camera}
            />
            <View pointerEvents="none" style={styles.scanGuide} />
          </View>
        )}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function resultTitle(result: GymScanResultDto) {
  if (result.outcome === 'started') return 'WORKOUT STARTED';
  if (result.outcome === 'too_early') return 'KEEP GOING';
  if (result.outcome === 'verified') return 'WORKOUT DAY VERIFIED';
  return 'SCAN REJECTED';
}

function resultMessage(result: GymScanResultDto) {
  if (result.outcome === 'started') {
    return 'Workout tracking is active on the server. Scan this same poster again after the minimum time.';
  }
  if (result.outcome === 'too_early') {
    return 'The session is active, but the 30-minute minimum has not been reached yet.';
  }
  if (result.outcome === 'verified') {
    return 'Entry and exit were verified. This is your one eligible contest day for today.';
  }
  return rejectionMessage(result.rejectionReason ?? null);
}

function rejectionMessage(reason: string | null) {
  const messages: Record<string, string> = {
    competition_unavailable: 'Join the active contest before scanning a gym poster.',
    daily_limit_reached: 'You already earned one verified contest day today.',
    gym_inactive: 'This gym is not active for the current contest.',
    inaccurate_location: gymLocationAccuracyWarning,
    invalid_or_revoked_credential: 'This poster is invalid or has been replaced by the gym.',
    outside_geofence: 'You must be within 75 metres of the configured gym to scan.',
    replayed_event: 'This scan was already processed. Scan the poster again.',
    session_expired: 'The four-hour session window expired. Start a new visit with another scan.',
    session_gym_mismatch: 'Finish at the same gym where this session started.'
  };
  return reason
    ? (messages[reason] ?? 'The server could not verify this scan.')
    : 'The server could not verify this scan.';
}

function formatRemaining(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getScanErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (isGymLocationAccuracyValidationMessage(error.message)) {
      return gymLocationAccuracyWarning;
    }
    if (error.status === 401) {
      return 'Your account session expired. Sign in again, then rescan the poster.';
    }
  }
  return getUserFacingErrorMessage(
    error,
    'The scan could not be verified. Check your connection and try again.'
  );
}

const styles = StyleSheet.create({
  screen: brandScreenStyles.content,
  instructions: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  stateCard: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  remaining: {
    alignSelf: 'center',
    fontFamily: fontFamilies.display
  },
  cameraShell: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 1,
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.md,
    ...cyberGlow.cyan
  },
  camera: {
    flex: 1
  },
  scanGuide: {
    position: 'absolute',
    top: '18%',
    right: '18%',
    bottom: '18%',
    left: '18%',
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: radii.sm
  }
});
