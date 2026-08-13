import { reload, sendEmailVerification, type User } from 'firebase/auth';

export type AuthenticatedUser = {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoUrl: string | null;
  providerIds: readonly string[];
  uid: string;
};

type ReloadFirebaseUser = (user: User) => Promise<void>;
type SendFirebaseVerificationEmail = (user: User) => Promise<void>;

export async function sendInitialVerificationEmail(
  user: User,
  sendVerificationEmail: SendFirebaseVerificationEmail = sendEmailVerification
) {
  try {
    await sendVerificationEmail(user);
    return true;
  } catch {
    return false;
  }
}

export async function refreshFirebaseUser(user: User, reloadUser: ReloadFirebaseUser = reload) {
  await reloadUser(user);
  await user.getIdToken(true);
  return mapFirebaseUser(user);
}

export function mapFirebaseUser(user: User): AuthenticatedUser {
  return {
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    photoUrl: user.photoURL,
    providerIds: user.providerData.map((provider) => provider.providerId),
    uid: user.uid
  };
}
