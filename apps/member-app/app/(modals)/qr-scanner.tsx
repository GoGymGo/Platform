import type { GymScanResultDto } from '@gogymgo/contracts';
import { useQueryClient } from '@tanstack/react-query';
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
import { createWorkoutSessionRepository } from '@/data/sessionRepository';
import {
  extractGymScanCredential,
  getGymScanRemainingSeconds,
  isGymLocationAccuracyValidationMessage,
  isGymScanCompletionReady
} from '@/domain/gymScan';
import { formatCompetitionOpeningDateTime } from '@/domain/competition';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { getGymScanSetupRoute } from '@/navigation/gymScanFlow';
import { ApiError } from '@/services/api/client';
import { readGymScanLocation } from '@/services/gymScanLocation';
import {
  clearPendingGymScanSession,
  readPendingGymScan,
  rememberGymScanCredential,
  rememberGymScanResult,
  type PendingGymScan
} from '@/services/pendingGymScan';
import { useApi } from '@/state/api';
import { useAppTour } from '@/state/appTour';
import { useCompetitionRegion } from '@/state/competitionRegion';
import {
  createAppTourPendingGymScan,
  createAppTourStartedGymLocationResult,
  createAppTourVerifiedGymLocationResult
} from '@/testing/appTourData';

type ScanUiState = 'ready' | 'locating' | 'submitting' | 'result';

export default function QrScannerModal() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (!mobileGymVerificationAvailable && !appTourActive) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO HOME"
        body="Gym QR and live-location verification must be completed in GoGymGo on a phone or tablet. Your account and Contest enrollment are unchanged."
        onAction={() => router.replace('/home')}
        title="PHONE OR TABLET REQUIRED"
      />
    );
  }

  return <MobileQrScannerModal />;
}

function MobileQrScannerModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { active: appTourActive, scenario: appTourScenario } = useAppTour();
  const { competitionRegion } = useCompetitionRegion();
  const {
    credential: linkedCredential,
    enrollment,
    next
  } = useLocalSearchParams<{
    credential?: string;
    enrollment?: string;
    next?: string;
  }>();
  const enrollmentPresenceMode = enrollment === '1';
  const { api, configured } = useApi();
  const repository = useMemo(() => (api ? createGymScanRepository(api) : null), [api]);
  const sessionRepository = useMemo(
    () => createWorkoutSessionRepository(configured && api ? 'api' : 'unavailable', api),
    [api, configured]
  );
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
    setupStep
  } = useSessionRegistrationAccess({
    gymQrCredential:
      enrollmentPresenceMode || pendingIntent?.credentialValidUntil
        ? null
        : effectiveCredential,
    gymQrScanKey:
      enrollmentPresenceMode || pendingIntent?.credentialValidUntil
        ? null
        : (pendingIntent?.createdAt ?? null)
  });
  const [permission, requestPermission] = useCameraPermissions();
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [scanLocked, setScanLocked] = useState(false);
  const [state, setState] = useState<ScanUiState>('ready');
  const [result, setResult] = useState<GymScanResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [workoutCancelled, setWorkoutCancelled] = useState(false);
  const activeSession = pendingIntent?.activeSession ?? null;
  const activeSessionId =
    activeSession?.sessionId ??
    (result?.outcome === 'started' || result?.outcome === 'too_early'
      ? result.sessionId
      : null);
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
  const workoutActive =
    !enrollmentPresenceMode &&
    Boolean(activeSession || result?.outcome === 'started' || result?.outcome === 'too_early');
  const workoutVerified = !enrollmentPresenceMode && result?.outcome === 'verified';
  const workoutGymName = result?.gymName ?? activeSession?.gymName ?? null;
  const scannedContestAcceptsWorkouts = scannedCompetition?.status === 'active';

  useEffect(() => {
    let active = true;

    async function hydratePendingIntent() {
      try {
        const stored = linkedCredentialValue
          ? await rememberGymScanCredential(linkedCredentialValue)
          : await readPendingGymScan();
        const pending =
          appTourActive && !enrollmentPresenceMode
            ? createAppTourPendingGymScan(appTourScenario)
            : stored;
        if (active) {
          setPendingIntent(pending);
          setResult(
            appTourActive && !enrollmentPresenceMode && appTourScenario === 'workout-complete'
              ? createAppTourVerifiedGymLocationResult()
              : null
          );
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
  }, [appTourActive, appTourScenario, enrollmentPresenceMode, linkedCredentialValue]);

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
    async (rawPayload: string | null, allowEnrolledGym = false) => {
      if (
        (!allowEnrolledGym && scanLocked) ||
        (!repository && !appTourActive && !enrollmentPresenceMode)
      ) {
        return;
      }
      const credential = rawPayload ? extractGymScanCredential(rawPayload) : null;
      if (!credential && !allowEnrolledGym) {
        setScanLocked(true);
        setError(
          enrollmentPresenceMode
            ? 'That code is not a valid GoGymGo gym QR. Check the poster and try again.'
            : 'The saved Partner gym could not be verified. Return to Training and try again.'
        );
        return;
      }
      setScanLocked(true);
      setError(null);
      setResult(null);
      setState('locating');
      try {
        if (credential) {
          setPendingIntent(await rememberGymScanCredential(credential));
        }
      } catch {
        if (enrollmentPresenceMode) {
          setState('result');
          setError('The gym QR could not be saved. Check device storage and scan again.');
          return;
        }
        // A storage failure must not replace an authoritative workout scan result.
      }
      if (enrollmentPresenceMode) {
        if (!credential) return;
        router.replace(
          next === 'sign-up'
            ? { pathname: '/sign-up', params: { next: 'gym-scan' } }
            : next === 'region'
              ? '/region?source=gym-scan'
              : '/commitment?source=gym-scan'
        );
        return;
      }
      if (!repository && !appTourActive) return;
      let location;
      try {
        location = appTourActive
          ? {
              accuracyMeters: 5,
              latitude: 48.4284,
              longitude: -123.3656,
              status: 'location-read' as const
            }
          : await readGymScanLocation();
      } catch (locationError) {
        setState('result');
        setError(
          getUserFacingErrorMessage(
            locationError,
            'Location services could not be opened. Check device settings and try again.'
          )
        );
        return;
      }
      if (location.status !== 'location-read') {
        setState('result');
        setError(locationStatusMessage(location.status));
        return;
      }
      setState('submitting');
      try {
        const scanResult = appTourActive
          ? activeSession
            ? createAppTourVerifiedGymLocationResult()
            : createAppTourStartedGymLocationResult()
          : await repository!.scan({
              accuracyMeters: location.accuracyMeters,
              ...(allowEnrolledGym && scannedCompetition
                ? { competitionId: scannedCompetition.id }
                : { credential: credential! }),
              eventId: randomUUID(),
              latitude: location.latitude,
              longitude: location.longitude
            });
        setResult(scanResult);
        if (appTourActive) {
          setPendingIntent((current) => {
            const pending = current ?? createAppTourPendingGymScan('ready');
            return {
              ...pending,
              activeSession:
                scanResult.outcome === 'started' || scanResult.outcome === 'too_early'
                  ? {
                      expiresAt: scanResult.expiresAt!,
                      gymName: scanResult.gymName ?? null,
                      minimumCompleteAt: scanResult.minimumCompleteAt!,
                      sessionId: scanResult.sessionId!,
                      startedAt: scanResult.startedAt!
                    }
                  : null,
              credential: credential ?? pendingIntent?.credential ?? ''
            };
          });
          return;
        }
        try {
          const recoveryCredential = credential ?? effectiveCredential;
          if (recoveryCredential) {
            setPendingIntent(await rememberGymScanResult(recoveryCredential, scanResult));
          } else {
            setPendingIntent((current) =>
              current
                ? {
                    ...current,
                    activeSession:
                      scanResult.outcome === 'started' || scanResult.outcome === 'too_early'
                        ? {
                            expiresAt: scanResult.expiresAt!,
                            gymName: scanResult.gymName ?? null,
                            minimumCompleteAt: scanResult.minimumCompleteAt!,
                            sessionId: scanResult.sessionId!,
                            startedAt: scanResult.startedAt!
                          }
                        : null
                  }
                : current
            );
          }
        } catch {
          // The server response remains authoritative if local continuity storage fails.
        }
      } catch (scanError) {
        setError(getScanErrorMessage(scanError));
      } finally {
        setState('result');
      }
    },
    [
      activeSession,
      appTourActive,
      effectiveCredential,
      enrollmentPresenceMode,
      pendingIntent?.credential,
      next,
      repository,
      router,
      scanLocked,
      scannedCompetition
    ]
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

  async function cancelWorkout() {
    if (!activeSessionId || cancelling) {
      return;
    }

    setCancelling(true);
    setError(null);
    try {
      if (!appTourActive) {
        await sessionRepository.cancelSession(activeSessionId);
        setPendingIntent(await clearPendingGymScanSession());
        void queryClient.invalidateQueries({ queryKey: ['competition-progress'] });
      } else {
        setPendingIntent((current) =>
          current ? { ...current, activeSession: null } : current
        );
      }
      setCancelConfirming(false);
      setResult(null);
      setScanLocked(false);
      setState('ready');
      setWorkoutCancelled(true);
    } catch (cancelError) {
      setError(
        getUserFacingErrorMessage(
          cancelError,
          'The workout could not be cancelled. Check your connection and try again.'
        )
      );
    } finally {
      setCancelling(false);
    }
  }

  if (pendingIntentLoading) {
    return (
      <ScreenLoadingState
        body={
          enrollmentPresenceMode
            ? 'Preparing location check.'
            : 'Preparing workout.'
        }
      />
    );
  }
  if (!enrollmentPresenceMode && registrationChecking) {
    return <ScreenLoadingState body="Checking your Contest." />;
  }
  if (!enrollmentPresenceMode && registrationError) {
    return (
      <RecoverableScreenError
        body="We couldn&apos;t check your Contest. Try again."
        onRetry={() => void retryRegistration()}
        retrying={registrationRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }
  if (!enrollmentPresenceMode && !registrationReady) {
    const setupRoute = getGymScanSetupRoute(setupStep);
    return <Redirect href={setupRoute ?? '/home'} />;
  }
  if (!enrollmentPresenceMode && scannedCompetition && !scannedContestAcceptsWorkouts) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO HOME"
        body={`You are registered for ${scannedCompetition.name}. Workout location checks open on ${formatCompetitionOpeningDateTime(
          scannedCompetition.startsAt,
          competitionRegion.timeZone
        )}.`}
        onAction={() => router.replace('/home')}
        title="REGISTRATION COMPLETE"
      />
    );
  }
  if ((!configured || !repository) && !appTourActive && !enrollmentPresenceMode) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO TRAINING"
        body="Location checks are unavailable. Try again later."
        onAction={() => router.replace('/session')}
        title="LOCATION SERVICE OFFLINE"
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
          label={enrollmentPresenceMode ? 'PARTNER GYM QR' : 'GYM LOCATION'}
          onBack={() =>
            goBackOrReplace(router, enrollmentPresenceMode ? '/commitment' : '/session')
          }
          step={enrollmentPresenceMode ? 'CONTEST ENROLLMENT' : 'VERIFICATION'}
        />
        {workoutActive ? (
          <HUDBorderBox
            glow
            style={styles.timerCard}
            tone={error ? 'red' : completionReady ? 'green' : 'cyan'}
          >
            <TerminalText
              glow
              tone={error ? 'red' : completionReady ? 'green' : 'cyan'}
              variant="label"
            >
              {completionReady ? '30 MINUTES COMPLETE' : 'WORKOUT TIMER'}
            </TerminalText>
            <TerminalText glow live="polite" style={styles.remaining} tone="pink" variant="display">
              {completionReady ? '00:00' : formatRemaining(displayRemainingSeconds)}
            </TerminalText>
            {workoutGymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {workoutGymName}
              </TerminalText>
            ) : null}
            <TerminalText tone={error ? 'red' : 'muted'} uppercase={false} variant="body">
              {error ??
                (completionReady
                  ? 'Tap Finish Workout to check your gym location.'
                  : 'Finish unlocks at 00:00.')}
            </TerminalText>
            {busy ? (
              <TerminalText live="polite" glow tone="cyan" variant="label">
                {state === 'locating' ? 'READING LIVE LOCATION...' : 'VERIFYING WITH SERVER...'}
              </TerminalText>
            ) : (
              <>
                {error?.startsWith('Location access') && Platform.OS !== 'web' ? (
                  <CyberButtonOutline
                    label="OPEN DEVICE SETTINGS"
                    onPress={() => void Linking.openSettings()}
                    tone="amber"
                  />
                ) : null}
                <CyberButtonPrimary
                  disabled={!completionReady || cancelling}
                  label={
                    completionReady
                      ? error
                        ? 'TRY LOCATION CHECK AGAIN'
                        : 'CHECK LOCATION + FINISH'
                      : 'FINISH WORKOUT AT 00:00'
                  }
                  onPress={() => void submitCredential(null, true)}
                />
                {cancelConfirming ? (
                  <HUDBorderBox style={styles.cancelConfirmation} tone="red">
                    <TerminalText live="assertive" glow tone="red" variant="label">
                      CANCEL THIS WORKOUT?
                    </TerminalText>
                    <TerminalText tone="muted" uppercase={false} variant="body">
                      This session will close without verification, score or Prize Draw Entries.
                    </TerminalText>
                    <CyberButtonPrimary
                      disabled={cancelling}
                      label={cancelling ? 'CANCELLING...' : 'YES, CANCEL WORKOUT'}
                      onPress={() => void cancelWorkout()}
                      tone="red"
                    />
                    <CyberButtonOutline
                      disabled={cancelling}
                      label="NO, KEEP WORKING OUT"
                      onPress={() => {
                        setCancelConfirming(false);
                        setError(null);
                      }}
                    />
                  </HUDBorderBox>
                ) : (
                  <CyberButtonOutline
                    disabled={cancelling}
                    label="CANCEL WORKOUT"
                    onPress={() => {
                      setCancelConfirming(true);
                      setError(null);
                    }}
                    tone="red"
                  />
                )}
              </>
            )}
          </HUDBorderBox>
        ) : workoutCancelled ? (
          <HUDBorderBox glow style={styles.stateCard} tone="amber">
            <TerminalText glow live="polite" tone="amber" variant="label">
              WORKOUT CANCELLED
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              The session is closed. No verified credit, score or Prize Draw Entries were awarded.
            </TerminalText>
            <CyberButtonPrimary
              label="START ANOTHER WORKOUT"
              onPress={() => setWorkoutCancelled(false)}
            />
            <CyberButtonOutline
              label="BACK TO HOME"
              onPress={() => router.replace('/home')}
            />
          </HUDBorderBox>
        ) : workoutVerified ? (
          <HUDBorderBox glow style={styles.stateCard} tone="green">
            <TerminalText glow live="polite" tone="green" variant="label">
              WORKOUT VERIFIED
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Today now counts toward your Contest goal.
            </TerminalText>
            {workoutGymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {workoutGymName}
              </TerminalText>
            ) : null}
            <CyberButtonOutline
              label="BACK TO HOME"
              onPress={() => router.replace('/home')}
            />
          </HUDBorderBox>
        ) : (
          <>
            <BrandScreenHeader
              description={
                enrollmentPresenceMode
                  ? 'Scan this gym\'s current Contest poster.'
                  : 'Start and finish at your selected gym. No QR rescan.'
              }
              eyebrow={enrollmentPresenceMode ? 'INITIAL GYM SELECTION' : 'VERIFIED GYM WORKOUT'}
              title={enrollmentPresenceMode ? "SCAN THIS GYM'S QR" : 'START YOUR WORKOUT'}
            />

            <HUDBorderBox style={styles.instructions} tone="cyan">
              <TerminalText tone="cyan" variant="label">
                {enrollmentPresenceMode
                  ? 'SCAN ONCE // SELECT THIS GYM'
                  : 'FRESH LOCATION // START + FINISH'}
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                {enrollmentPresenceMode
                  ? 'Scan once, then return to registration.'
                  : 'Check location to start. Train for 30 minutes, then check location to finish.'}
              </TerminalText>
            </HUDBorderBox>
          </>
        )}

        {workoutActive || workoutVerified || workoutCancelled ? null : busy ? (
          <HUDBorderBox glow style={styles.stateCard} tone="cyan">
            <TerminalText live="polite" glow tone="cyan" variant="label">
              {state === 'locating' ? 'READING LIVE LOCATION...' : 'VERIFYING WITH SERVER...'}
            </TerminalText>
          </HUDBorderBox>
        ) : result || error ? (
          <HUDBorderBox glow style={styles.stateCard} tone={error ? 'red' : resultTone}>
            <TerminalText glow tone={error ? 'red' : resultTone} variant="label">
              {error
                ? enrollmentPresenceMode
                  ? 'GYM NOT SELECTED'
                  : 'LOCATION CHECK NOT COMPLETED'
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
                  ? 'Check your live location to finish and verify this workout.'
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
              <CyberButtonPrimary
                label="CHECK LOCATION + FINISH"
                onPress={() => void submitCredential(null, true)}
              />
            ) : null}
            <CyberButtonOutline
              label={
                error
                  ? 'TRY AGAIN'
                  : result?.outcome === 'verified'
                    ? 'BACK TO HOME'
                    : 'CLOSE FOR NOW'
              }
              onPress={() => {
                if (error) {
                  scanAgain();
                } else if (result?.outcome === 'verified') {
                  router.replace('/home');
                } else {
                  goBackOrReplace(router, '/session');
                }
              }}
            />
          </HUDBorderBox>
        ) : !enrollmentPresenceMode && scannedCompetition && !scanLocked ? (
          <HUDBorderBox
            glow
            style={styles.stateCard}
            tone={activeSession && completionReady ? 'green' : 'cyan'}
          >
            <TerminalText
              glow
              tone={activeSession && completionReady ? 'green' : 'cyan'}
              variant="label"
            >
              {activeSession
                ? completionReady
                  ? 'READY FOR FINAL LOCATION CHECK'
                  : 'WORKOUT TIMER ACTIVE'
                : 'READY FOR START LOCATION CHECK'}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {activeSession
                ? completionReady
                  ? 'Return within 75 metres, then finish.'
                  : 'Keep training. Finish unlocks at 00:00.'
                : 'Be within 75 metres, then start.'}
            </TerminalText>
            {activeSession?.gymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {activeSession.gymName}
              </TerminalText>
            ) : null}
            {activeSession ? (
              <TerminalText glow style={styles.remaining} tone="pink" variant="display">
                {completionReady ? 'READY' : formatRemaining(displayRemainingSeconds)}
              </TerminalText>
            ) : null}
            <CyberButtonPrimary
              disabled={Boolean(activeSession) && !completionReady}
              label={
                activeSession
                  ? completionReady
                    ? 'CHECK LOCATION + FINISH'
                    : 'FINISH AVAILABLE AT 00:00'
                  : 'CHECK LOCATION + START WORKOUT'
              }
              onPress={() => void submitCredential(null, true)}
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
              QR frames stay on this device and aren&apos;t stored.
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
              autofocus={Platform.OS === 'web' ? 'on' : 'off'}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              facing="back"
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
  return 'LOCATION CHECK REJECTED';
}

function resultMessage(result: GymScanResultDto) {
  if (result.outcome === 'started') {
    return 'Workout started. Finish unlocks after 30 minutes.';
  }
  if (result.outcome === 'too_early') {
    return 'Keep training until the timer reaches 00:00.';
  }
  if (result.outcome === 'verified') {
    return 'Workout verified. Today counts toward your Contest.';
  }
  return rejectionMessage(result.rejectionReason ?? null);
}

function rejectionMessage(reason: string | null) {
  const messages: Record<string, string> = {
    competition_unavailable: 'Join the active Contest before starting a gym location check.',
    completion_grace_expired:
      'The 15-minute completion period has ended, so this workout cannot be verified.',
    daily_limit_reached: 'You already earned one verified contest day today.',
    gym_inactive: 'This gym is not active for the current contest.',
    gym_selection_required:
      'This Contest enrollment does not have a Partner gym selected. Scan the current gym poster once to repair setup.',
    inaccurate_location: gymLocationAccuracyWarning,
    insufficient_completion_time:
      'There is not enough time left to complete the required 30-minute workout before the 15-minute completion period ends.',
    invalid_or_revoked_credential:
      'The gym selected during registration is no longer active for this Contest.',
    outside_geofence: 'You must be within 75 metres of the selected Partner gym.',
    replayed_event: 'This location check was already processed. Try again.',
    session_expired: 'The workout session window expired. Start a new gym visit.',
    session_gym_mismatch: 'Finish at the same gym where this session started.'
  };
  return reason
    ? (messages[reason] ?? 'The server could not verify this location check.')
    : 'The server could not verify this location check.';
}

function locationStatusMessage(
  status: 'location-unavailable' | 'mobile-required' | 'permission-denied'
) {
  if (status === 'permission-denied') {
    return 'Location access was not allowed. Enable location in device settings, then try again.';
  }
  if (status === 'mobile-required') {
    return 'Open GoGymGo on a phone or tablet to complete the live location check.';
  }
  return 'Your live location could not be read. Check location services and try again.';
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
      return 'Your account session expired. Sign in again, then retry the location check.';
    }
  }
  return getUserFacingErrorMessage(
    error,
    'The location check could not be verified. Check your connection and try again.'
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
  timerCard: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  cancelConfirmation: {
    gap: spacing.md,
    padding: spacing.md
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
