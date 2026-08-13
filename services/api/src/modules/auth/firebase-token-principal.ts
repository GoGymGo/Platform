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
  const claimedRoles = decodedToken.roles;
  const roles = Array.isArray(claimedRoles)
    ? claimedRoles.filter((role): role is string => typeof role === 'string')
    : ['user'];
  const signInProvider = decodedToken.firebase?.sign_in_provider;

  return {
    ...(decodedToken.email ? { email: decodedToken.email } : {}),
    emailVerified: decodedToken.email_verified === true,
    firebaseUid: decodedToken.uid,
    roles: roles.length > 0 ? roles : ['user'],
    signInProvider: typeof signInProvider === 'string' ? signInProvider : null,
    tokenIssuedAt: decodedToken.iat,
  };
}
