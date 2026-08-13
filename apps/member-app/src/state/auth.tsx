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
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

import { isFirebaseConfigured, missingFirebaseEnvironmentValues } from '@/config/firebase';
import { normalizeEmail, shouldClearAuthSession } from '@/domain/auth';
import { getFirebaseAuth } from '@/services/auth/firebaseClient';
import {
  mapFirebaseUser,
  refreshFirebaseUser,
  sendInitialVerificationEmail,
  type AuthenticatedUser
} from '@/services/auth/firebaseIdentity';
import {
  signInWithAppleProvider,
  signInWithGoogleProvider,
  signOutSocialProviders,
  socialProviderAvailability,
  type SocialUserCredential
} from '@/services/auth/socialAuth';
import { useAppTour } from '@/state/appTour';
import { appTourAuthToken, appTourUser } from '@/testing/appTourData';

export type { AuthenticatedUser } from '@/services/auth/firebaseIdentity';

export type AuthSignInResult = {
  isNewUser: boolean;
  user: AuthenticatedUser;
};

export type AuthAccountCreationResult = AuthSignInResult & {
  verificationEmailSent: boolean;
};

type AuthContextValue = {
  appleSignInAvailable: boolean;
  createAccount: (email: string, password: string) => Promise<AuthAccountCreationResult>;
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
  const { active: appTourActive } = useAppTour();

  return appTourActive
    ? <AppTourAuthProvider>{children}</AppTourAuthProvider>
    : <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
}

function AppTourAuthProvider({ children }: PropsWithChildren) {
  const { scenario } = useAppTour();
  const [syncedScenario, setSyncedScenario] = useState(scenario);
  const [user, setUser] = useState<AuthenticatedUser | null>(
    scenario === 'new-player' ? null : appTourUser
  );

  if (syncedScenario !== scenario) {
    setSyncedScenario(scenario);
    setUser((currentUser) => (scenario === 'new-player' ? null : (currentUser ?? appTourUser)));
  }
  const createAccount = useCallback(async (email: string) => {
    const createdUser: AuthenticatedUser = {
      ...appTourUser,
      email,
      emailVerified: false,
      providerIds: ['password']
    };
    setUser(createdUser);
    return {
      isNewUser: true,
      user: createdUser,
      verificationEmailSent: true
    } satisfies AuthAccountCreationResult;
  }, []);
  const refreshUser = useCallback(async () => {
    if (!user) {
      return null;
    }

    const verifiedUser = {
      ...user,
      emailVerified: true
    };
    setUser(verifiedUser);
    return verifiedUser;
  }, [user]);
  const signIn = useCallback(async () => {
    setUser(appTourUser);
    return {
      isNewUser: false,
      user: appTourUser
    } satisfies AuthSignInResult;
  }, []);
  const signOutUser = useCallback(async () => {
    setUser(null);
  }, []);
  const value: AuthContextValue = {
    appleSignInAvailable: scenario !== 'new-player',
    createAccount,
    firebaseConfigured: true,
    getIdToken: async () => appTourAuthToken,
    googleSignInAvailable: scenario !== 'new-player',
    loading: false,
    missingConfiguration: [],
    refreshUser,
    resendVerificationEmail: async () => undefined,
    sendPasswordReset: async () => undefined,
    signInWithApple: signIn,
    signInWithEmail: signIn,
    signInWithGoogle: signIn,
    signOutUser,
    user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function FirebaseAuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    const auth = getFirebaseAuth();
    auth.useDeviceLanguage();

    let active = true;
    let requestVersion = 0;
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      const currentRequest = ++requestVersion;
      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      void refreshFirebaseUser(nextUser)
        .then((refreshedUser) => {
          if (
            active &&
            currentRequest === requestVersion &&
            auth.currentUser?.uid === nextUser.uid
          ) {
            setUser(refreshedUser);
          }
        })
        .catch(async (error: unknown) => {
          if (shouldClearAuthSession(error)) {
            await signOut(auth).catch(() => undefined);
          }
          if (active && currentRequest === requestVersion) {
            setUser(null);
          }
        })
        .finally(() => {
          if (active && currentRequest === requestVersion) {
            setLoading(false);
          }
        });
    });

    return () => {
      active = false;
      requestVersion += 1;
      unsubscribe();
    };
  }, []);

  const createAccount = useCallback(async (email: string, password: string) => {
    const auth = requireFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);

    const verificationEmailSent = await sendInitialVerificationEmail(credential.user);
    const result = {
      ...mapCredential(credential, true),
      verificationEmailSent
    } satisfies AuthAccountCreationResult;
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
    setUser(result.user);
    return result;
  }, []);

  const signInWithApple = useCallback(async () => {
    const credential = await signInWithAppleProvider(requireFirebaseAuth());
    const result = mapSocialCredential(credential);
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

    try {
      const refreshedUser = await refreshFirebaseUser(currentUser);
      setUser(refreshedUser);
      return refreshedUser;
    } catch (error) {
      if (shouldClearAuthSession(error)) {
        setUser(null);
        await signOut(requireFirebaseAuth()).catch(() => undefined);
      }
      throw error;
    }
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
  return mapCredential(credential, getAdditionalUserInfo(credential)?.isNewUser ?? false);
}

function mapCredential(credential: SocialUserCredential, isNewUser: boolean): AuthSignInResult {
  return {
    isNewUser,
    user: mapFirebaseUser(credential.user)
  };
}
