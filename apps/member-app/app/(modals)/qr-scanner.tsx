import type { GymScanResultDto } from '@gogymgo/contracts';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { RecoverableScreenError } from '@/components/reliability';
import { SessionUnavailable } from '@/components/session';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { createGymScanRepository } from '@/data/gymScanRepository';
import { useSessionRegistrationAccess } from '@/hooks/useSessionRegistrationAccess';
import { goBackOrReplace } from '@/navigation/goBack';
import { ApiError } from '@/services/api/client';
import { readGymScanLocation } from '@/services/gymScanLocation';
import { useApi } from '@/state/api';

type ScanUiState = 'ready' | 'locating' | 'submitting' | 'result';

export default function QrScannerModal() {
  const router = useRouter();
  const { credential: linkedCredential } = useLocalSearchParams<{
    credential?: string;
  }>();
  const { api, configured } = useApi();
  const repository = useMemo(
    () => (api ? createGymScanRepository(api) : null),
    [api]
  );
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
  const [state, setState] = useState<ScanUiState>('ready');
  const [result, setResult] = useState<GymScanResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitCredential = useCallback(
    async (rawPayload: string) => {
      if (!repository || scanLocked) return;
      const credential = extractCredential(rawPayload);
      if (!credential) {
        setScanLocked(true);
        setError('That code is not a valid GoGymGo gym QR. Check the poster and scan again.');
        return;
      }
      setScanLocked(true);
      setError(null);
      setResult(null);
      setState('locating');
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
        setResult(
          await repository.scan({
            accuracyMeters: location.accuracyMeters,
            credential,
            eventId: randomUUID(),
            latitude: location.latitude,
            longitude: location.longitude
          })
        );
      } catch (scanError) {
        setError(getScanErrorMessage(scanError));
      } finally {
        setState('result');
      }
    },
    [repository, scanLocked]
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

  if (registrationChecking) {
    return <ScreenLoadingState body="Checking your competition registration." />;
  }
  if (registrationError) {
    return (
      <RecoverableScreenError
        body="Your competition setup could not be checked. Retry before scanning the gym poster."
        onRetry={() => void retryRegistration()}
        retrying={registrationRetrying}
        title="COULD NOT CHECK SETUP"
      />
    );
  }
  if (!registrationReady) {
    return (
      <SessionUnavailable
        actionLabel={setupActionLabel}
        body={setupMessage}
        onAction={() => {
          if (setupRoute) router.replace(setupRoute);
        }}
        title="FINISH SETUP"
      />
    );
  }
  if (!configured || !repository) {
    return (
      <SessionUnavailable
        actionLabel="BACK TO TRAINING"
        body="The secure scan service is temporarily unavailable. Your account and competition data are safe."
        onAction={() => router.replace('/session')}
        title="QR SERVICE OFFLINE"
      />
    );
  }

  const busy = state === 'locating' || state === 'submitting';
  const resultTone = result?.outcome === 'verified'
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
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <TerminalText glow tone="cyan" variant="label">
              STATIC GYM QR
            </TerminalText>
            <TerminalText glow style={styles.title} tone="cyan" variant="title">
              SCAN TO START OR FINISH
            </TerminalText>
          </View>
          <CyberButtonOutline
            label="CLOSE"
            onPress={() => goBackOrReplace(router, '/session')}
            style={styles.closeButton}
          />
        </View>

        <HUDBorderBox style={styles.instructions} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            ONE POSTER // TWO SCANS
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Scan once while inside the gym to start the server timer. After 30
            minutes, scan the same poster again to verify your workout day. Live
            location is checked at both scans; raw coordinates are never saved.
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
              {error ? 'SCAN NOT COMPLETED' : resultTitle(result!)}
            </TerminalText>
            <TerminalText
              live={error || result?.outcome === 'rejected' ? 'assertive' : 'polite'}
              tone="muted"
              uppercase={false}
              variant="body"
            >
              {error ?? resultMessage(result!)}
            </TerminalText>
            {result?.gymName ? (
              <TerminalText glow tone="cyan" variant="label">
                {result.gymName}
              </TerminalText>
            ) : null}
            {result?.outcome === 'started' || result?.outcome === 'too_early' ? (
              <TerminalText glow style={styles.remaining} tone="pink" variant="display">
                {formatRemaining(result.remainingSeconds)}
              </TerminalText>
            ) : null}
            {error?.startsWith('Location access') ? (
              <CyberButtonOutline
                label={Platform.OS === 'web' ? 'TRY AFTER ALLOWING LOCATION' : 'OPEN DEVICE SETTINGS'}
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
            <CyberButtonOutline label="SCAN AGAIN" onPress={scanAgain} />
          </HUDBorderBox>
        ) : linkedCredential && !scanLocked ? (
          <HUDBorderBox glow style={styles.stateCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              GYM POSTER LINK READY
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Confirm to read your live location and submit this poster to the
              secure scan endpoint.
            </TerminalText>
            <CyberButtonPrimary
              label="VERIFY THIS POSTER ->"
              onPress={() => void submitCredential(linkedCredential)}
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

function extractCredential(payload: string): string | null {
  const trimmed = payload.trim();
  if (trimmed.length >= 32 && trimmed.length <= 256 && !trimmed.includes('://')) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'app.gogymgo.com' || url.pathname !== '/scan') return null;
    const credential = url.searchParams.get('credential')?.trim() ?? '';
    return credential.length >= 32 && credential.length <= 256
      ? credential
      : null;
  } catch {
    return null;
  }
}

function resultTitle(result: GymScanResultDto) {
  if (result.outcome === 'started') return 'SESSION STARTED';
  if (result.outcome === 'too_early') return 'KEEP GOING';
  if (result.outcome === 'verified') return 'WORKOUT DAY VERIFIED';
  return 'SCAN REJECTED';
}

function resultMessage(result: GymScanResultDto) {
  if (result.outcome === 'started') {
    return 'Your authoritative 30-minute server timer is running. Scan this same poster again after the minimum time.';
  }
  if (result.outcome === 'too_early') {
    return 'The session is active, but the 30-minute minimum has not been reached yet.';
  }
  if (result.outcome === 'verified') {
    return 'Entry and exit were verified. This is your one eligible competition day for today.';
  }
  return rejectionMessage(result.rejectionReason ?? null);
}

function rejectionMessage(reason: string | null) {
  const messages: Record<string, string> = {
    competition_unavailable: 'Join the active competition before scanning a gym poster.',
    daily_limit_reached: 'You already earned one verified competition day today.',
    gym_inactive: 'This gym is not active for the current competition.',
    inaccurate_location: 'Location accuracy is too low. Move near a window and try again.',
    invalid_or_revoked_credential: 'This poster is invalid or has been replaced by the gym.',
    outside_geofence: 'You must be within 75 metres of the configured gym to scan.',
    replayed_event: 'This scan was already processed. Scan the poster again.',
    session_expired: 'The four-hour session window expired. Start a new visit with another scan.',
    session_gym_mismatch: 'Finish at the same gym where this session started.'
  };
  return reason ? messages[reason] ?? 'The server could not verify this scan.' : 'The server could not verify this scan.';
}

function formatRemaining(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getScanErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your account session expired. Sign in again, then rescan the poster.';
  }
  return error instanceof Error
    ? error.message
    : 'The scan could not be verified. Check your connection and try again.';
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    fontFamily: fontFamilies.display
  },
  closeButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
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
