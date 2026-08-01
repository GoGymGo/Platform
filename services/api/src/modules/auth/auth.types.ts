export interface AuthenticatedPrincipal {
  email?: string;
  emailVerified: boolean;
  firebaseUid: string;
  roles: string[];
  tokenIssuedAt: number;
}

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<AuthenticatedPrincipal>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
