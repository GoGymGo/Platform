import { getAuth, type Auth } from 'firebase/auth';

import { getFirebaseApp } from './firebaseApp';

let firebaseAuth: Auth | undefined;

export function getFirebaseAuth() {
  firebaseAuth ??= getAuth(getFirebaseApp());
  return firebaseAuth;
}
