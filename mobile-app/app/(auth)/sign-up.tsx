import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AuthConfigurationNotice,
  AuthScreenShell,
  AuthStatusNotice,
  AuthTextField
} from '@/components/auth';
import {
  CyberButtonPrimary,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import { LegalConsentCheckbox, LegalDocumentLinks } from '@/components/legal';
import { SocialAuthButtons } from '@/components/socialAuthButtons';
import { accountLegalConsentLabels } from '@/constants/legal';
import {
  getAuthErrorMessage,
  hasAuthFormErrors,
  validateSignUpForm,
  type AuthFormErrors
} from '@/domain/auth';
import { useSocialAuthFlow } from '@/hooks/useSocialAuthFlow';
import { colors, spacing } from '@/constants/theme';
import { useAuth, type AuthSignInResult } from '@/state/auth';

export default function SignUpScreen() {
  const router = useRouter();
  const {
    appleSignInAvailable,
    createAccount,
    firebaseConfigured,
    googleSignInAvailable
  } = useAuth();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [password, setPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const accountLegalAccepted = privacyAccepted && termsAccepted;
  const completeSocialSignIn = (result: AuthSignInResult) => {
    router.replace(result.isNewUser ? '/identity' : '/home');
  };
  const {
    busyProvider,
    continueWithApple,
    continueWithGoogle,
    socialError
  } = useSocialAuthFlow(completeSocialSignIn);
  const busy = submitting || Boolean(busyProvider);
  const hasSocialProviders = appleSignInAvailable || googleSignInAvailable;

  async function submitEmailAccount() {
    if (!accountLegalAccepted) {
      setFormError('Accept the Privacy Policy and Terms to create your account.');
      return;
    }

    const nextErrors = validateSignUpForm(email, password, confirmPassword);
    setErrors(nextErrors);
    setFormError(undefined);

    if (hasAuthFormErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    try {
      await createAccount(email, password);
      router.replace({
        pathname: '/verify-email',
        params: { next: 'identity' }
      });
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenShell
      description="Create one secure account for your commitment, verified workouts, entries and payouts."
      eyebrow="ACCOUNT SETUP"
      onBack={() => router.replace('/join')}
      title="CREATE YOUR ACCOUNT"
    >
      {!firebaseConfigured ? <AuthConfigurationNotice /> : null}

      <View style={styles.stack}>
          {hasSocialProviders ? (
            <>
              <SocialAuthButtons
                appleAvailable={appleSignInAvailable}
                busyProvider={busyProvider}
                disabled={busy || !firebaseConfigured || !accountLegalAccepted}
                googleAvailable={googleSignInAvailable}
                onApplePress={continueWithApple}
                onGooglePress={continueWithGoogle}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <TerminalText tone="dim" variant="micro">
                  OR USE EMAIL
                </TerminalText>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : null}

          <HUDBorderBox style={styles.form} tone="muted">
            <AuthTextField
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              keyboardType="email-address"
              label="EMAIL"
              onChangeText={setEmail}
              placeholder="you@example.com"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <AuthTextField
              autoCapitalize="none"
              autoComplete="new-password"
              error={errors.password}
              label="PASSWORD"
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              textContentType="newPassword"
              value={password}
            />
            <AuthTextField
              autoCapitalize="none"
              autoComplete="new-password"
              error={errors.confirmPassword}
              label="CONFIRM PASSWORD"
              onChangeText={setConfirmPassword}
              placeholder="Repeat your password"
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
            />
            {formError ? <AuthStatusNotice message={formError} tone="red" /> : null}
            {socialError ? <AuthStatusNotice message={socialError} tone="red" /> : null}
            <View style={styles.legalSection}>
              <LegalDocumentLinks />
              <LegalConsentCheckbox
                checked={privacyAccepted}
                label={accountLegalConsentLabels.privacy}
                onToggle={() => setPrivacyAccepted((current) => !current)}
              />
              <LegalConsentCheckbox
                checked={termsAccepted}
                label={accountLegalConsentLabels.terms}
                onToggle={() => setTermsAccepted((current) => !current)}
              />
            </View>
            <CyberButtonPrimary
              disabled={busy || !firebaseConfigured || !accountLegalAccepted}
              label={submitting ? 'CREATING ACCOUNT...' : 'CREATE SECURE ACCOUNT ->'}
              onPress={submitEmailAccount}
            />
          </HUDBorderBox>

        </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg
  },
  form: {
    gap: spacing.md,
    padding: spacing.lg
  },
  legalSection: {
    gap: spacing.sm
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderMuted
  }
});
