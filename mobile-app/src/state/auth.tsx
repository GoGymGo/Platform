import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth';

import {
  isFirebaseConfigured,
  missingFirebaseEnvironmentValues
} from '@/config/firebase';
import { normalizeEmail } from '@/domain/auth';
import { getFirebaseAuth } from '@/services/auth/firebaseClient';
import {
  signInWithAppleProvider,
  signInWithGoogleProvider,
  signOutSocialProviders,
  socialProviderAvailability,
  type SocialUserCredential
} from '@/services/auth/socialAuth';
import { recordAccountLegalAcceptance } from '@/services/legalAcceptance';

export type AuthenticatedUser = {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoUrl: string | null;
  providerIds: readonly string[];
  uid: string;
};

export type AuthSignInResult = {
  isNewUser: boolean;
  user: AuthenticatedUser;
};

type AuthContextValue = {
  appleSignInAvailable: boolean;
  createAccount: (email: string, password: string) => Promise<AuthSignInResult>;
  firebaseConfigured: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  googleSignInAvailable: boolean;
  loading: boolean;
  missingConfiguration: readonly string[];
  refreshUser: () => Promise<AuthenticatedUser | null>;
  resendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithApple: () => Promise<AuthSignInResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthSignInResult>;
  signInWithGoogle: () => Promise<AuthSignInResult>;
  signOutUser: () => Promise<void>;
  user: AuthenticatedUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    const auth = getFirebaseAuth();
    auth.useDeviceLanguage();

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser ? mapFirebaseUser(nextUser) : null);
      setLoading(false);
    });
  }, []);

  const createAccount = useCallback(async (email: string, password: string) => {
    const auth = requireFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(
      auth,
      normalizeEmail(email),
      password
    );

    void sendEmailVerification(credential.user).catch(() => {
      // The verification screen offers an explicit resend action.
    });
    void recordAccountLegalAcceptance(credential.user.uid).catch(() => {
      // Account creation must not fail after Firebase has already created the user.
      // The production API will record the authoritative acceptance separately.
    });

    const result = mapCredential(credential, true);
    setUser(result.user);
    return result;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(
      requireFirebaseAuth(),
      normalizeEmail(email),
      password
    );
    const result = mapCredential(credential, false);
    setUser(result.user);
    return result;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const credential = await signInWithGoogleProvider(requireFirebaseAuth());
    const result = mapSocialCredential(credential);
    if (result.isNewUser) {
      void recordAccountLegalAcceptance(result.user.uid).catch(() => {
        // The production API will retry the authoritative acceptance record.
      });
    }
    setUser(result.user);
    return result;
  }, []);

  const signInWithApple = useCallback(async () => {
    const credential = await signInWithAppleProvider(requireFirebaseAuth());
    const result = mapSocialCredential(credential);
    if (result.isNewUser) {
      void recordAccountLegalAcceptance(result.user.uid).catch(() => {
        // The production API will retry the authoritative acceptance record.
      });
    }
    setUser(result.user);
    return result;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(requireFirebaseAuth(), normalizeEmail(email));
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const currentUser = requireFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new Error('A signed-in user is required to verify email.');
    }

    await sendEmailVerification(currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = requireFirebaseAuth().currentUser;
    if (!currentUser) {
      setUser(null);
      return null;
    }

    await reload(currentUser);
    const refreshedUser = mapFirebaseUser(currentUser);
    setUser(refreshedUser);
    return refreshedUser;
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    const currentUser = requireFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new Error('A signed-in user is required to obtain an ID token.');
    }

    return currentUser.getIdToken(forceRefresh);
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = requireFirebaseAuth();
    await Promise.all([signOutSocialProviders(), signOut(auth)]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      appleSignInAvailable: socialProviderAvailability.apple,
      createAccount,
      firebaseConfigured: isFirebaseConfigured,
      getIdToken,
      googleSignInAvailable: socialProviderAvailability.google,
      loading,
      missingConfiguration: missingFirebaseEnvironmentValues,
      refreshUser,
      resendVerificationEmail,
      sendPasswordReset,
      signInWithApple,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      user
    }),
    [
      createAccount,
      getIdToken,
      loading,
      refreshUser,
      resendVerificationEmail,
      sendPasswordReset,
      signInWithApple,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      user
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

function requireFirebaseAuth() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Authentication configuration is missing.');
  }

  return getFirebaseAuth();
}

function mapSocialCredential(credential: SocialUserCredential): AuthSignInResult {
  return mapCredential(
    credential,
    getAdditionalUserInfo(credential)?.isNewUser ?? false
  );
}

function mapCredential(
  credential: SocialUserCredential,
  isNewUser: boolean
): AuthSignInResult {
  return {
    isNewUser,
    user: mapFirebaseUser(credential.user)
  };
}

function mapFirebaseUser(user: User): AuthenticatedUser {
  return {
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    photoUrl: user.photoURL,
    providerIds: user.providerData.map((provider) => provider.providerId),
    uid: user.uid
  };
}
