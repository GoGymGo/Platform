export const ACCOUNT_IDENTITY_ADMIN = Symbol('ACCOUNT_IDENTITY_ADMIN');

export interface AccountIdentityAdmin {
  deleteAccount(firebaseUid: string): Promise<void>;
}
