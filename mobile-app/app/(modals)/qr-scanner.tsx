import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenLoadingState,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { RecoverableScreenError } from '@/components/reliability';
import { SessionUnavailable } from '@/components/session';
import { WorkoutFlowProgress } from '@/components/workoutFlowProgress';
import { verifiedPartnerGymCatalogAvailable } from '@/config/partnerGyms';
import { sessionTimeScale } from '@/config/runtime';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { isGoGymGoPartnerCode } from '@/domain/partnerGymQr';
import { getSessionElapsedSeconds, workoutRules } from '@/domain/workoutProgress';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAppTour } from '@/state/appTour';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function QrScannerModal() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { activeSession, recordGymQrScan, sessionActionError, sessionActionPending } =
    useWorkoutProgress();
  const {
    checking: registrationChecking,
    error: registrationError,
    ready: registrationReady,
    retry: retryRegistration,
    retrying: registrationRetrying,
    setupActionLabel,
    setupMessage,
    setupRoute
  } = useSessionRegistrationAccess();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [scanVerified, setScanVerified] = useState(false);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isExitScan = params.mode === 'exit';
  const scanMode = isExitScan ? 'exit' : 'entry';
  const exitReady = Boolean(
    activeSession?.verificationMethod === 'partnerGymQr' &&
    activeSession.midSessionVerified &&
    getSessionElapsedSeconds(activeSession.startedAt, new Date(), sessionTimeScale) >=
      workoutRules.minimumSessionSeconds
  );
  const canScan = !isExitScan || exitReady;

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    verifyScannedPayload(result.data);
  }

  function verifyScannedPayload(data: string) {
    if (scanLocked || !canScan) {
      return;
    }

    setScanLocked(true);
    if (
      isGoGymGoPartnerCode(data, scanMode) ||
      (
        appTourActive &&
        data === `gogymgo:gym:${scanMode}:app-tour`
      )
    ) {
      setScannedPayload(data);
      setScanVerified(true);
      setStatusMessage(`${isExitScan ? 'Exit' : 'Entry'} QR confirmed for this partner gym.`);
      return;
    }

    setStatusMessage('That is not a valid GoGymGo partner-gym code. Check the sign and try again.');
  }

  async function continueAfterScan() {
    if (!scanVerified || !scannedPayload) {
      return;
    }

    if (isExitScan) {
      if (await recordGymQrScan(scannedPayload)) {
        router.replace('/workout/complete');
      }
      return;
    }

    router.replace({
      pathname: '/workout/identity-check',
      params: { qrPayload: scannedPayload }
    });
  }

  function retryScan() {
    setScanLocked(false);
    setScanVerified(false);
    setScannedPayload(null);
    setStatusMessage(null);
  }

  if (!verifiedPartnerGymCatalogAvailable && !appTourActive) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO METHODS"
        body="Partner-gym QR verification will be enabled after participating gyms are verified and published."
        onAction={() => router.replace('/workout/method')}
        title="NO VERIFIED PARTNER GYMS"
      />
    );
  }

  if (!isExitScan && !activeSession && registrationChecking) {
    return <ScreenLoadingState body="Checking your competition registration." />;
  }

  if (!isExitScan && !activeSession && registrationError) {
    return (
      <RecoverableScreenError
        body="Your competition setup could not be checked. Retry before scanning an entry code."
        onRetry={() => void retryRegistration()}
        retrying={registrationRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }

  if (!isExitScan && !activeSession && !registrationReady) {
    return (
      <SessionUnavailable
        actionLabel={setupActionLabel}
        body={setupMessage}
        onAction={() => {
          if (setupRoute) {
            router.replace(setupRoute as Href);
          }
        }}
        title="FINISH SETUP"
      />
    );
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow style={styles.headerLabel} tone="cyan" variant="label">
            {isExitScan ? 'WORKOUT CHECK-OUT' : 'WORKOUT CHECK-IN'}
          </TerminalText>
          <CyberButtonOutline
            label="CLOSE"
            onPress={() =>
              goBackOrReplace(router, isExitScan ? '/workout/active' : '/workout/method')
            }
            style={styles.closeButton}
          />
        </View>
        <WorkoutFlowProgress
          stage={isExitScan ? 'complete' : 'start'}
          style={styles.workoutProgress}
        />

        <View style={styles.centerContent}>
          <TerminalText glow tone="cyan" variant="label">
            PARTNER GYM QR
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            {isExitScan ? 'SCAN EXIT QR' : 'SCAN ENTRY QR'}
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            {isExitScan
              ? 'The exit code closes the verified partner-gym session.'
              : 'The entry code confirms your gym before the secure device presence check.'}
          </TerminalText>

          {!canScan ? (
            <HUDBorderBox style={styles.stateCard} tone="amber">
              <TerminalText glow tone="amber" variant="label">
                ACTION NEEDED
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Finish 30 minutes and the mid-session presence check first.
              </TerminalText>
            </HUDBorderBox>
          ) : appTourActive ? (
            <HUDBorderBox style={styles.stateCard} tone="cyan">
              <TerminalText glow tone="cyan" variant="label">
                APP TOUR QR SIMULATOR
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Use a local testing code without opening the camera or contacting a gym service.
              </TerminalText>
              <CyberButtonPrimary
                disabled={scanLocked}
                label={scanLocked ? 'Test QR complete' : 'Confirm test QR'}
                onPress={() => verifyScannedPayload(
                  `gogymgo:gym:${scanMode}:app-tour`
                )}
              />
            </HUDBorderBox>
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
                GoGymGo needs camera access only while you scan the partner gym code. Frames are
                processed locally and are not stored.
              </TerminalText>
              <CyberButtonPrimary
                label={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
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

          {statusMessage || sessionActionError ? (
            <TerminalText
              live={scanVerified ? 'polite' : 'assertive'}
              style={styles.statusMessage}
              tone={sessionActionError ? 'amber' : scanVerified ? 'green' : 'amber'}
              uppercase={false}
              variant="body"
            >
              {sessionActionError ?? statusMessage}
            </TerminalText>
          ) : null}
        </View>

        {scanVerified ? (
          <CyberButtonPrimary
            disabled={sessionActionPending}
            label={isExitScan ? 'Verify and finish' : 'Continue to secure check'}
            onPress={() => void continueAfterScan()}
          />
        ) : scanLocked ? (
          <CyberButtonOutline label="SCAN AGAIN" onPress={retryScan} />
        ) : null}
        <TerminalText style={styles.note} tone="dim" uppercase={false} variant="caption">
          Entry and exit scans are both required for partner-gym verification.
        </TerminalText>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  workoutProgress: {
    marginBottom: spacing.md
  },
  headerLabel: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  closeButton: {
    width: 104,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  body: {
    maxWidth: 320,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  cameraShell: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 1,
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
  },
  stateCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.lg
  },
  statusMessage: {
    maxWidth: 360,
    marginTop: spacing.lg,
    textAlign: 'center'
  },
  note: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  }
});
