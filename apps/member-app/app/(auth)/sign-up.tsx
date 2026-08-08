import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AuthConfigurationNotice,
  AuthScreenShell,
  AuthStatusNotice,
  AuthTextField
} from '@/components/auth';
import {
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import { FirstRunPrimaryButton } from '@/components/firstRun';
import { LegalDocumentLinks } from '@/components/legal';
import { SocialAuthButtons } from '@/components/socialAuthButtons';
import {
  getAuthErrorMessage,
  hasAuthFormErrors,
  validateSignUpForm,
  type AuthFormErrors
} from '@/domain/auth';
import { useSocialAuthFlow } from '@/hooks/useSocialAuthFlow';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import {
  getGymScanPostAuthRoute,
  gymScanAuthNext,
  gymScanSetupNext,
  isGymScanContinuation
} from '@/navigation/gymScanFlow';
import { useAuth, type AuthSignInResult } from '@/state/auth';
import { useAppData } from '@/data/appDataHooks';

export default function SignUpScreen() {
  const router = useRouter();
  const { challengeInvite, next } = useLocalSearchParams<{
    challengeInvite?: string;
    next?: string;
  }>();
  const gymScanContinuation = isGymScanContinuation(next);
  const { social } = useAppData();
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
  const [submitting, setSubmitting] = useState(false);
  const completeSocialSignIn = async (result: AuthSignInResult) => {
    if (challengeInvite) {
      await social.redeemContactInvitation(challengeInvite);
    }
    router.replace(
      gymScanContinuation
        ? getGymScanPostAuthRoute(result.isNewUser)
        : result.isNewUser
          ? '/region'
          : '/home'
    );
  };
  const {
    busyProvider,
    continueWithApple,
    continueWithGoogle,
    socialError
  } = useSocialAuthFlow(completeSocialSignIn);
  const busy = submitting || Boolean(busyProvider);
  const hasSocialProviders = appleSignInAvailable || googleSignInAvailable;
  const emailAccountReady =
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  async function submitEmailAccount() {
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
        params: {
          next: challengeInvite
            ? `challenge:${challengeInvite}`
            : gymScanContinuation
              ? gymScanSetupNext
              : 'region'
        }
      });
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenShell
      description={gymScanContinuation
        ? 'Your gym scan is saved. Create your account, finish setup, and GoGymGo will return you to Start Workout.'
        : 'Create one secure account for your Weekly Goal, Verified workouts and brand Rewards.'}
      eyebrow={gymScanContinuation ? 'GYM SCAN SAVED' : 'ACCOUNT SETUP'}
      onBack={() => router.replace(
        gymScanContinuation
          ? { pathname: '/sign-in', params: { next: gymScanAuthNext } }
          : '/join'
      )}
      title={gymScanContinuation ? 'CREATE ACCOUNT TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
    >
      {!firebaseConfigured ? <AuthConfigurationNotice /> : null}

      <View style={styles.stack}>
          {hasSocialProviders ? (
            <>
              <SocialAuthButtons
                appleAvailable={appleSignInAvailable}
                busyProvider={busyProvider}
                disabled={busy || !firebaseConfigured}
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
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: undefined }));
                setFormError(undefined);
              }}
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
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
                setFormError(undefined);
              }}
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
              onChangeText={(value) => {
                setConfirmPassword(value);
                setErrors((current) => ({ ...current, confirmPassword: undefined }));
                setFormError(undefined);
              }}
              placeholder="Repeat your password"
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
            />
            {formError ? <AuthStatusNotice message={formError} tone="red" /> : null}
            {socialError ? <AuthStatusNotice message={socialError} tone="red" /> : null}
            {!emailAccountReady ? (
              <TerminalText style={styles.editorialCaption} tone="dim" uppercase={false} variant="caption">
                Complete your email and both password fields to continue.
              </TerminalText>
            ) : null}
            <FirstRunPrimaryButton
              disabled={busy || !firebaseConfigured || !emailAccountReady}
              label={submitting ? 'CREATING ACCOUNT...' : 'CREATE SECURE ACCOUNT ->'}
              onPress={submitEmailAccount}
            />
            <View style={styles.legalSection}>
              <TerminalText
                style={styles.legalNotice}
                tone="dim"
                uppercase={false}
                variant="caption"
              >
                Privacy and Terms are available now. You will review and accept
                the current versions during onboarding.
              </TerminalText>
              <LegalDocumentLinks compact />
            </View>
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
    alignItems: 'center',
    gap: spacing.xs
  },
  legalNotice: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center'
  },
  editorialCaption: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 21
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
