import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  AuthConfigurationNotice,
  AuthScreenShell,
  AuthStatusNotice,
  AuthTextField
} from '@/components/auth';
import { CyberButtonOutline, CyberButtonPrimary, HUDBorderBox } from '@/components/cyber';
import { getAuthErrorMessage, validateEmail } from '@/domain/auth';
import { spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAuth } from '@/state/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { firebaseConfigured, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<'green' | 'red'>('green');
  const [submitting, setSubmitting] = useState(false);

  async function submitReset() {
    const nextError = validateEmail(email);
    setEmailError(nextError);
    setMessage(undefined);
    if (nextError) {
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setMessageTone('green');
      setMessage('PASSWORD RESET EMAIL SENT. CHECK YOUR INBOX.');
    } catch (error) {
      setMessageTone('red');
      setMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenShell
      description="Enter your account email and Firebase will send a secure password-reset link."
      eyebrow="ACCOUNT RECOVERY"
      footer={(
        <CyberButtonOutline
          label="BACK TO SIGN IN"
          onPress={() => goBackOrReplace(router, '/sign-in')}
        />
      )}
      title="RESET PASSWORD"
    >
      {!firebaseConfigured ? <AuthConfigurationNotice /> : null}
      <HUDBorderBox style={styles.form} tone="muted">
        <AuthTextField
          autoCapitalize="none"
          autoComplete="email"
          error={emailError}
          keyboardType="email-address"
          label="ACCOUNT EMAIL"
          onChangeText={setEmail}
          placeholder="you@example.com"
          textContentType="emailAddress"
          value={email}
        />
        {message ? <AuthStatusNotice message={message} tone={messageTone} /> : null}
        <CyberButtonPrimary
          disabled={submitting || !firebaseConfigured}
          label={submitting ? 'SENDING RESET...' : 'SEND RESET EMAIL ->'}
          onPress={submitReset}
        />
      </HUDBorderBox>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
    padding: spacing.lg
  }
});
