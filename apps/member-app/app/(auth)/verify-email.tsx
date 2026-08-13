import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import {
  AuthConfigurationNotice,
  AuthScreenShell,
  AuthStatusNotice
} from '@/components/auth';
import {
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import { FirstRunPrimaryButton, FirstRunSecondaryButton } from '@/components/firstRun';
import { getAuthErrorMessage } from '@/domain/auth';
import {
  getAuthenticatedHomeRoute,
  isMobileWebGymVerificationDevice
} from '@/domain/mobileGymVerification';
import { fontFamilies, spacing } from '@/constants/theme';
import {
  gymScanAuthNext,
  gymScanSetupNext,
  gymScanSource,
  gymScanWorkoutRoute
} from '@/navigation/gymScanFlow';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { active: appTourActive } = useAppTour();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();
  const { next, verificationEmailSent } = useLocalSearchParams<{
    next?: string;
    verificationEmailSent?: string;
  }>();
  const {
    firebaseConfigured,
    refreshUser,
    resendVerificationEmail,
    signOutUser,
    user
  } = useAuth();
  const [busyAction, setBusyAction] = useState<'check' | 'resend' | 'signout' | null>(null);
  const initialVerificationDeliveryFailed = verificationEmailSent === 'false';
  const [message, setMessage] = useState<string | undefined>(
    initialVerificationDeliveryFailed
      ? 'THE FIRST VERIFICATION EMAIL COULD NOT BE SENT. CHOOSE RESEND EMAIL TO TRY AGAIN.'
      : undefined
  );
  const [messageTone, setMessageTone] = useState<'green' | 'amber' | 'red'>(
    initialVerificationDeliveryFailed ? 'red' : 'amber'
  );
  const challengeInvite = next?.startsWith('challenge:') ? next.slice('challenge:'.length) : null;
  const polling = useRef(false);
  const continueAfterVerification = useCallback(() => {
    if (!mobileGymVerificationAvailable && !challengeInvite) {
      router.replace(getAuthenticatedHomeRoute(false));
      return;
    }
    router.replace(
      challengeInvite
        ? { pathname: '/join', params: { challengeInvite } }
        : next === gymScanSetupNext
          ? `/region?source=${gymScanSource}`
          : next === gymScanAuthNext
            ? gymScanWorkoutRoute
        : next === 'region'
          ? '/region'
          : next === 'identity'
            ? '/identity'
            : next === 'profile'
              ? '/profile'
              : getAuthenticatedHomeRoute(mobileGymVerificationAvailable)
    );
  }, [challengeInvite, mobileGymVerificationAvailable, next, router]);

  useEffect(() => {
    if (appTourActive || !user || user.emailVerified) {
      return;
    }

    let active = true;
    const pollVerification = async () => {
      if (polling.current) {
        return;
      }
      polling.current = true;
      try {
        const refreshedUser = await refreshUser();
        if (active && refreshedUser?.emailVerified) {
          continueAfterVerification();
        }
      } catch {
        // The visible manual action reports errors; background checks stay quiet.
      } finally {
        polling.current = false;
      }
    };
    const interval = setInterval(() => void pollVerification(), 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    appTourActive,
    continueAfterVerification,
    refreshUser,
    user,
    user?.emailVerified
  ]);

  async function checkVerification() {
    setBusyAction('check');
    setMessage(undefined);
    try {
      const refreshedUser = await refreshUser();
      if (refreshedUser?.emailVerified) {
        continueAfterVerification();
        return;
      }
      setMessageTone('amber');
      setMessage('EMAIL IS NOT VERIFIED YET. OPEN THE EMAIL LINK, THEN CHECK AGAIN.');
    } catch (error) {
      setMessageTone('red');
      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function resendVerification() {
    setBusyAction('resend');
    setMessage(undefined);
    try {
      await resendVerificationEmail();
      setMessageTone('green');
      setMessage('A NEW VERIFICATION EMAIL WAS SENT.');
    } catch (error) {
      setMessageTone('red');
      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function exitAccount() {
    setBusyAction('signout');
    try {
      await signOutUser();
      router.replace(
        next === gymScanAuthNext || next === gymScanSetupNext
          ? { pathname: '/sign-in', params: { next: gymScanAuthNext } }
          : '/sign-in'
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AuthScreenShell
      description={appTourActive
        ? 'This preview simulates the email-verification step without sending a message.'
        : next === gymScanAuthNext || next === gymScanSetupNext
          ? 'Your Partner gym selection is saved. Verify your email and GoGymGo will continue your workout setup automatically.'
          : initialVerificationDeliveryFailed
            ? 'Your account was created, but the first verification message was not delivered. Retry below.'
            : 'Verify the email attached to your GoGymGo account before entering contest flows.'}
      eyebrow={next === gymScanAuthNext || next === gymScanSetupNext
        ? 'PARTNER GYM SAVED'
        : 'ACCOUNT SECURITY'}
      title="CHECK YOUR EMAIL"
    >
      {!firebaseConfigured ? <AuthConfigurationNotice /> : null}
      {!user ? (
        <HUDBorderBox style={styles.panel} tone="amber">
          <TerminalText style={styles.panelBody} tone="muted" uppercase={false} variant="body">
            Sign in first so GoGymGo can check the correct email account.
          </TerminalText>
          <FirstRunPrimaryButton
            label="GO TO SIGN IN"
            onPress={() => router.replace(
              next === gymScanAuthNext || next === gymScanSetupNext
                ? { pathname: '/sign-in', params: { next: gymScanAuthNext } }
                : '/sign-in'
            )}
          />
        </HUDBorderBox>
      ) : (
        <HUDBorderBox style={styles.panel} tone="cyan">
          <TerminalText tone="cyan" variant="label">
            VERIFY EMAIL FOR
          </TerminalText>
          <TerminalText style={styles.panelBody} tone="text" uppercase={false} variant="body">
            {user.email ?? 'YOUR ACCOUNT EMAIL'}
          </TerminalText>
          <TerminalText style={styles.panelBody} tone="muted" uppercase={false} variant="body">
            {appTourActive
              ? 'Choose Continue Demo to confirm the sample account and proceed to region setup.'
              : 'Open the verification email and confirm the address. This screen continues automatically when verification is complete.'}
          </TerminalText>
          {message ? <AuthStatusNotice message={message} tone={messageTone} /> : null}
          <FirstRunPrimaryButton
            disabled={Boolean(busyAction)}
            label={busyAction === 'check'
              ? 'CHECKING...'
              : appTourActive
                ? 'CONTINUE DEMO ->'
                : 'CHECK VERIFICATION ->'}
            onPress={checkVerification}
          />
          {!appTourActive ? (
            <FirstRunSecondaryButton
              disabled={Boolean(busyAction)}
              label={busyAction === 'resend' ? 'SENDING...' : 'RESEND EMAIL'}
              onPress={resendVerification}
            />
          ) : null}
          <FirstRunSecondaryButton
            disabled={Boolean(busyAction)}
            label={busyAction === 'signout' ? 'SIGNING OUT...' : 'USE ANOTHER ACCOUNT'}
            onPress={exitAccount}
            tone="cyan"
          />
        </HUDBorderBox>
      )}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    padding: spacing.lg
  },
  panelBody: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 23
  }
});
