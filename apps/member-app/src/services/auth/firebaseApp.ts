import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { getFirebaseOptions } from '@/config/firebase';
import { assertLiveServicesAllowed } from '@/config/demoMode';

let firebaseApp: FirebaseApp | undefined;

export function getFirebaseApp() {
  assertLiveServicesAllowed('Firebase');
  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(getFirebaseOptions());
  return firebaseApp;
}
