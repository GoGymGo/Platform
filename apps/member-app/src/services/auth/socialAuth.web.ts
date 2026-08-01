import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type Auth,
  type UserCredential
} from 'firebase/auth';

import { isAppleAuthEnabled, isGoogleAuthEnabled } from '@/config/firebase';

export const socialProviderAvailability = {
  apple: isAppleAuthEnabled,
  google: isGoogleAuthEnabled
} as const;

export function signInWithGoogleProvider(auth: Auth) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export function signInWithAppleProvider(auth: Auth) {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return signInWithPopup(auth, provider);
}

export async function signOutSocialProviders() {
  return undefined;
}

export type SocialUserCredential = UserCredential;
