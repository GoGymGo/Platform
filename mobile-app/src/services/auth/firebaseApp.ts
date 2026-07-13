import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { getFirebaseOptions } from '@/config/firebase';

let firebaseApp: FirebaseApp | undefined;

export function getFirebaseApp() {
  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(getFirebaseOptions());
  return firebaseApp;
}
