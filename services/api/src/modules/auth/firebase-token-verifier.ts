import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';
import { getGoGymGoFirebaseApp } from './firebase-admin-app';
import { authenticatedPrincipalFromDecodedToken } from './firebase-token-principal';

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async verifyIdToken(token: string): Promise<AuthenticatedPrincipal> {
    const [{ getAuth }, app] = await Promise.all([
      import('firebase-admin/auth'),
      getGoGymGoFirebaseApp(this.config),
    ]);
    const decodedToken = await getAuth(app).verifyIdToken(token, true);
    return authenticatedPrincipalFromDecodedToken(decodedToken);
  }
}
