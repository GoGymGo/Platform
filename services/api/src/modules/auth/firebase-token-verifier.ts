import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import type { Environment } from '../../config/environment';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';
import { getGoGymGoFirebaseApp } from './firebase-admin-app';
import { authenticatedPrincipalFromDecodedToken } from './firebase-token-principal';

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly loadAuth: FirebaseAuthLoader = loadFirebaseAuth,
  ) {}

  async verifyIdToken(token: string): Promise<AuthenticatedPrincipal> {
    const auth = await this.loadAuth(this.config);
    const decodedToken = await auth.verifyIdToken(token, true);
    return authenticatedPrincipalFromDecodedToken(decodedToken);
  }
}

type FirebaseAuthLoader = (
  config: ConfigService<Environment, true>,
) => Promise<Pick<Auth, 'verifyIdToken'>>;

async function loadFirebaseAuth(config: ConfigService<Environment, true>) {
  const [{ getAuth }, app] = await Promise.all([
    import('firebase-admin/auth'),
    getGoGymGoFirebaseApp(config),
  ]);
  return getAuth(app);
}
