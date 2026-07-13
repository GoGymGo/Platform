export const ACCOUNT_IDENTITY_ADMIN = Symbol('ACCOUNT_IDENTITY_ADMIN');

export interface AccountIdentityAdmin {
  deleteAccount(firebaseUid: string): Promise<void>;
}

export class UnavailableAccountIdentityAdmin implements AccountIdentityAdmin {
  deleteAccount(): Promise<void> {
    return Promise.reject(
      new Error('Firebase account administration is unavailable.'),
    );
  }
}
