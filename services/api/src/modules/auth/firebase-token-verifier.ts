import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';
import { getGoGymGoFirebaseApp } from './firebase-admin-app';

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async verifyIdToken(token: string): Promise<AuthenticatedPrincipal> {
    const [{ getAuth }, app] = await Promise.all([
      import('firebase-admin/auth'),
      getGoGymGoFirebaseApp(this.config),
    ]);
    const decodedToken = await getAuth(app).verifyIdToken(token, true);
    const claimedRoles: unknown = decodedToken.roles;
    const roles = Array.isArray(claimedRoles)
      ? claimedRoles.filter((role): role is string => typeof role === 'string')
      : ['user'];

    return {
      ...(decodedToken.email ? { email: decodedToken.email } : {}),
      emailVerified: decodedToken.email_verified === true,
      firebaseUid: decodedToken.uid,
      roles: roles.length > 0 ? roles : ['user'],
      signInProvider: decodedToken.firebase.sign_in_provider ?? null,
      tokenIssuedAt: decodedToken.iat,
    };
  }
}
