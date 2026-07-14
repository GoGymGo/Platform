import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { AccountIdentityAdmin } from './account-identity-admin';
import { getGoGymGoFirebaseApp } from './firebase-admin-app';

interface FirebaseAuthError {
  code?: string;
}

export class FirebaseAccountIdentityAdmin implements AccountIdentityAdmin {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async deleteAccount(firebaseUid: string): Promise<void> {
    const [{ getAuth }, app] = await Promise.all([
      import('firebase-admin/auth'),
      getGoGymGoFirebaseApp(this.config),
    ]);
    try {
      await getAuth(app).deleteUser(firebaseUid);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as FirebaseAuthError).code === 'auth/user-not-found'
      ) {
        return;
      }
      throw error;
    }
  }
}
