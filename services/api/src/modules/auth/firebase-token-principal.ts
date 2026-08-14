import type { AuthenticatedPrincipal } from './auth.types';

type DecodedFirebaseToken = {
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: unknown };
  iat: number;
  roles?: unknown;
  uid: string;
};

export function authenticatedPrincipalFromDecodedToken(
  decodedToken: DecodedFirebaseToken,
): AuthenticatedPrincipal {
  const signInProvider = decodedToken.firebase?.sign_in_provider;

  return {
    ...(decodedToken.email ? { email: decodedToken.email } : {}),
    emailVerified: decodedToken.email_verified === true,
    firebaseUid: decodedToken.uid,
    // Firebase custom claims are never an authorization source. Services load
    // the active user's roles from PostgreSQL for every protected operation.
    roles: ['user'],
    signInProvider: typeof signInProvider === 'string' ? signInProvider : null,
    tokenIssuedAt: decodedToken.iat,
  };
}
