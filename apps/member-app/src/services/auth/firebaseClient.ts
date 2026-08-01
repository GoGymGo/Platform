import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth
} from 'firebase/auth';

import { getFirebaseApp } from './firebaseApp';

let firebaseAuth: Auth | undefined;

export function getFirebaseAuth() {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getFirebaseApp();

  try {
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    if (!isAlreadyInitializedError(error)) {
      throw error;
    }

    firebaseAuth = getAuth(app);
  }

  return firebaseAuth;
}

function isAlreadyInitializedError(error: unknown) {
  return (
    error instanceof Error &&
    /already.*initialized|already-exists/i.test(error.message)
  );
}
