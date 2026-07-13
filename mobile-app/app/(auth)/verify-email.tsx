import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  AuthConfigurationNotice,
  AuthScreenShell,
  AuthStatusNotice
} from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import { getAuthErrorMessage } from '@/domain/auth';
import { isLocalPreviewEnabled } from '@/config/firebase';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/state/auth';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const {
    firebaseConfigured,
    refreshUser,
    resendVerificationEmail,
    signOutUser,
    user
  } = useAuth();
  const [busyAction, setBusyAction] = useState<'check' | 'resend' | 'signout' | null>(null);
  const [message, setMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<'green' | 'amber' | 'red'>('amber');
  const nextRoute = next === 'identity' ? '/identity' : next === 'profile' ? '/profile' : '/home';

  async function checkVerification() {
    setBusyAction('check');
    setMessage(undefined);
    try {
      const refreshedUser = await refreshUser();
      if (refreshedUser?.emailVerified) {
        router.replace(nextRoute);
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
      router.replace('/sign-in');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AuthScreenShell
      description="Verify the email attached to your GoGymGo account before entering competition flows."
      eyebrow="ACCOUNT SECURITY"
      title="CHECK YOUR EMAIL"
    >
      {!firebaseConfigured ? <AuthConfigurationNotice /> : null}
      {!user ? (
        <HUDBorderBox style={styles.panel} tone="amber">
          <TerminalText tone="muted" uppercase={false} variant="body">
            Sign in first so GoGymGo can check the correct email account.
          </TerminalText>
          <CyberButtonPrimary label="GO TO SIGN IN" onPress={() => router.replace('/sign-in')} />
        </HUDBorderBox>
      ) : (
        <HUDBorderBox style={styles.panel} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            VERIFICATION SENT TO
          </TerminalText>
          <TerminalText tone="text" uppercase={false} variant="body">
            {user.email ?? 'YOUR ACCOUNT EMAIL'}
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Open the Firebase verification email, confirm the address, then return here.
          </TerminalText>
          {message ? <AuthStatusNotice message={message} tone={messageTone} /> : null}
          <CyberButtonPrimary
            disabled={Boolean(busyAction)}
            label={busyAction === 'check' ? 'CHECKING...' : 'I VERIFIED MY EMAIL ->'}
            onPress={checkVerification}
          />
          <CyberButtonOutline
            disabled={Boolean(busyAction)}
            label={busyAction === 'resend' ? 'SENDING...' : 'RESEND EMAIL'}
            onPress={resendVerification}
          />
          {isLocalPreviewEnabled ? (
            <CyberButtonOutline
              label="PREVIEW APP FLOW"
              onPress={() => router.push('/identity')}
            />
          ) : null}
          <CyberButtonOutline
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
  }
});
