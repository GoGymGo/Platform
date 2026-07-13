import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';

const firebaseAppName = 'gogymgo-api';

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async verifyIdToken(token: string): Promise<AuthenticatedPrincipal> {
    const [{ applicationDefault, getApps, initializeApp }, { getAuth }] =
      await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
      ]);
    const emulatorHost = this.config.get('FIREBASE_AUTH_EMULATOR_HOST', {
      infer: true,
    });
    if (emulatorHost) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorHost;
    }

    const projectId = this.config.get('FIREBASE_PROJECT_ID', { infer: true });
    const existingApp = getApps().find((app) => app.name === firebaseAppName);
    const app =
      existingApp ??
      initializeApp(
        emulatorHost
          ? { projectId }
          : {
              credential: applicationDefault(),
              ...(projectId ? { projectId } : {}),
            },
        firebaseAppName,
      );
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
      tokenIssuedAt: decodedToken.iat,
    };
  }
}
