import { useState } from 'react';

import { getAuthErrorMessage } from '@/domain/auth';
import { useAuth, type AuthSignInResult } from '@/state/auth';

type SocialProvider = 'apple' | 'google';

export function useSocialAuthFlow(
  onSuccess: (result: AuthSignInResult) => void | Promise<void>
) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);
  const [socialError, setSocialError] = useState<string>();

  async function continueWith(provider: SocialProvider) {
    setBusyProvider(provider);
    setSocialError(undefined);

    try {
      const result =
        provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      await onSuccess(result);
    } catch (error) {
      setSocialError(getAuthErrorMessage(error));
    } finally {
      setBusyProvider(null);
    }
  }

  return {
    busyProvider,
    continueWithApple: () => continueWith('apple'),
    continueWithGoogle: () => continueWith('google'),
    socialError
  };
}
