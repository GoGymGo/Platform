import type { FirebaseOptions } from 'firebase/app';

type FirebaseEnvironmentValue = {
  label: string;
  value: string | undefined;
};

const firebaseEnvironmentValues: readonly FirebaseEnvironmentValue[] = [
  { label: 'EXPO_PUBLIC_FIREBASE_API_KEY', value: process.env.EXPO_PUBLIC_FIREBASE_API_KEY },
  { label: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', value: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN },
  { label: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', value: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID },
  { label: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', value: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET },
  {
    label: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    value: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  },
  { label: 'EXPO_PUBLIC_FIREBASE_APP_ID', value: process.env.EXPO_PUBLIC_FIREBASE_APP_ID }
];

export const missingFirebaseEnvironmentValues = firebaseEnvironmentValues
  .filter(({ value }) => !value?.trim())
  .map(({ label }) => label);

export const isFirebaseConfigured = missingFirebaseEnvironmentValues.length === 0;

export function getFirebaseOptions(): FirebaseOptions {
  if (!isFirebaseConfigured) {
    throw new Error(
      `Firebase Authentication is missing: ${missingFirebaseEnvironmentValues.join(', ')}`
    );
  }

  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  };
}

export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';

export const isGoogleAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
export const isAppleAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === 'true';
const developmentMode = typeof __DEV__ !== 'undefined' && __DEV__;

export const isLocalPreviewEnabled =
  developmentMode && process.env.EXPO_PUBLIC_ENABLE_ONBOARDING_PREVIEW === 'true';
