import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type Auth,
  type UserCredential
} from 'firebase/auth';

import {
  googleWebClientId,
  isAppleAuthEnabled,
  isFirebaseConfigured,
  isGoogleAuthEnabled
} from '@/config/firebase';
import { resolveSocialProviderAvailability } from '@/domain/socialAuthAvailability';

export const socialProviderAvailability = resolveSocialProviderAvailability({
  appleEnabled: isAppleAuthEnabled,
  firebaseConfigured: isFirebaseConfigured,
  googleEnabled: isGoogleAuthEnabled,
  googleWebClientId,
  platform: 'web'
});

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
