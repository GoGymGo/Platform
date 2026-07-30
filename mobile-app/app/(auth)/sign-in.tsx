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
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import { SocialAuthButtons } from '@/components/socialAuthButtons';
import { LegalDocumentLinks } from '@/components/legal';
import { useAppData } from '@/data/appDataHooks';
import {
  getAuthErrorMessage,
  hasAuthFormErrors,
  validateSignInForm,
  type AuthFormErrors
} from '@/domain/auth';
import { useSocialAuthFlow } from '@/hooks/useSocialAuthFlow';
import { colors, spacing } from '@/constants/theme';
import { useAuth, type AuthSignInResult } from '@/state/auth';

export default function SignInScreen() {
  const router = useRouter();
  const { challengeInvite } = useLocalSearchParams<{ challengeInvite?: string }>();
  const { social } = useAppData();
  const {
    appleSignInAvailable,
    firebaseConfigured,
    googleSignInAvailable,
    signInWithEmail,
    signOutUser,
    user
  } = useAuth();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const completeSignIn = async (result: AuthSignInResult) => {
    if (!result.user.emailVerified) {
      router.replace({
        pathname: '/verify-email',
        params: { next: challengeInvite ? `challenge:${challengeInvite}` : 'home' }
      });
      return;
    }
    if (challengeInvite) {
      await social.redeemContactInvitation(challengeInvite);
    }
    if (result.isNewUser) {
      router.replace('/region');
      return;
    }

    if (challengeInvite) {
      router.replace('/squad/social');
      return;
    }

    router.replace('/home?resume=1');
  };
  const {
    busyProvider,
    continueWithApple,
    continueWithGoogle,
    socialError
  } = useSocialAuthFlow(completeSignIn);
  const busy = submitting || Boolean(busyProvider);
  const hasSocialProviders = appleSignInAvailable || googleSignInAvailable;
  const emailSignInReady = email.trim().length > 0 && password.length > 0;

  async function submitEmailSignIn() {
    const nextErrors = validateSignInForm(email, password);
    setErrors(nextErrors);
    setFormError(undefined);

    if (hasAuthFormErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    try {
      await completeSignIn(await signInWithEmail(email, password));
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function clearSession() {
    setSubmitting(true);
    try {
      await signOutUser();
    } finally {
      setSubmitting(false);
    }
  }

  async function continueActiveSession() {
    if (!user) {
      return;
    }
    if (!user.emailVerified) {
      router.replace({
        pathname: '/verify-email',
        params: { next: challengeInvite ? `challenge:${challengeInvite}` : 'home' }
      });
      return;
    }

    setSubmitting(true);
    try {
      if (challengeInvite) {
        await social.redeemContactInvitation(challengeInvite);
        router.replace('/squad/social');
        return;
      }
      router.replace('/home?resume=1');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenShell
      description="Return to your Weekly Goal, verified workouts and prize draw entries."
      eyebrow="SECURE ACCESS"
      onBack={() => router.replace('/join')}
      title="WELCOME BACK"
    >
      {!firebaseConfigured ? <AuthConfigurationNotice /> : null}

      {user ? (
        <HUDBorderBox style={styles.activeSession} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            ACCOUNT SESSION ACTIVE
          </TerminalText>
          <TerminalText tone="text" uppercase={false} variant="body">
            {user.email ?? 'SIGNED-IN ACCOUNT'}
          </TerminalText>
          <CyberButtonPrimary
            label="CONTINUE TO GOGYMGO ->"
            onPress={continueActiveSession}
          />
          <CyberButtonOutline
            disabled={submitting}
            label={submitting ? 'SIGNING OUT...' : 'USE A DIFFERENT ACCOUNT'}
            onPress={clearSession}
            tone="cyan"
          />
        </HUDBorderBox>
      ) : (
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
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Continuing with Google or Apple creates an account when one does not
                exist. New players review the account agreements during setup.
              </TerminalText>
              <LegalDocumentLinks />

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
              autoComplete="current-password"
              error={errors.password}
              label="PASSWORD"
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
                setFormError(undefined);
              }}
              placeholder="Your password"
              secureTextEntry
              textContentType="password"
              value={password}
            />
            {formError ? <AuthStatusNotice message={formError} tone="red" /> : null}
            {socialError ? <AuthStatusNotice message={socialError} tone="red" /> : null}
            {!emailSignInReady ? (
              <TerminalText tone="dim" uppercase={false} variant="caption">
                Enter your email and password to continue.
              </TerminalText>
            ) : null}
            <CyberButtonPrimary
              disabled={busy || !firebaseConfigured || !emailSignInReady}
              label={submitting ? 'SIGNING IN...' : 'SIGN IN ->'}
              onPress={submitEmailSignIn}
            />
            <CyberButtonOutline
              disabled={busy}
              label="RESET PASSWORD"
              onPress={() => router.push('/forgot-password')}
            />
          </HUDBorderBox>

          <CyberButtonOutline
            disabled={busy}
            label="CREATE A NEW ACCOUNT"
            onPress={() => router.replace('/sign-up')}
          />
        </View>
      )}
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
  activeSession: {
    gap: spacing.md,
    padding: spacing.lg
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
