import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
  type Auth,
  type UserCredential
} from 'firebase/auth';
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse
} from 'react-native-nitro-google-signin';
import { Platform } from 'react-native';

import {
  googleWebClientId,
  isAppleAuthEnabled,
  isGoogleAuthEnabled
} from '@/config/firebase';

let googleConfigured = false;

export const socialProviderAvailability = {
  apple: Platform.OS === 'ios' && isAppleAuthEnabled,
  google: Boolean(googleWebClientId) && isGoogleAuthEnabled
} as const;

export async function signInWithGoogleProvider(auth: Auth) {
  if (!googleWebClientId) {
    throw new Error('Google Authentication configuration is missing.');
  }

  if (!googleConfigured) {
    GoogleOneTapSignIn.configure({
      autoSelectOnSignIn: false,
      offlineAccess: false,
      webClientId: googleWebClientId
    });
    googleConfigured = true;
  }

  await GoogleOneTapSignIn.checkPlayServices(true);
  let response = await GoogleOneTapSignIn.signIn();

  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }
  if (isCancelledResponse(response)) {
    throw createCodedError('SIGN_IN_CANCELLED', 'Google sign-in was canceled.');
  }
  if (!isSuccessResponse(response)) {
    throw new Error('Google Authentication did not return a credential.');
  }

  const credential = GoogleAuthProvider.credential(response.data.idToken);
  return signInWithCredential(auth, credential);
}

export async function signInWithAppleProvider(auth: Auth) {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Apple Authentication is not available on this device.');
  }

  const rawNonce = bytesToHex(Crypto.getRandomBytes(32));
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );
  const appleCredential = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple Authentication did not return an identity token.');
  }

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce
  });
  const result = await signInWithCredential(auth, credential);
  const displayName = formatAppleName(appleCredential.fullName);

  if (displayName && !result.user.displayName) {
    await updateProfile(result.user, { displayName });
  }

  return result;
}

export async function signOutSocialProviders() {
  if (!googleConfigured) {
    return;
  }

  try {
    await GoogleOneTapSignIn.signOut();
  } catch {
    // Firebase sign-out remains authoritative if the Google SDK has no active session.
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatAppleName(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
  return [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim();
}

function createCodedError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export type SocialUserCredential = UserCredential;
