export const HYPERWALLET_CLIENT = Symbol('HYPERWALLET_CLIENT');

export type SupportedPayoutCurrency = 'CAD' | 'MXN' | 'USD';

export interface HyperwalletUser {
  status: string;
  token: string;
}

export interface CreateHyperwalletUserInput {
  clientUserId: string;
  country: string;
  email: string;
}

export interface CreateHyperwalletPaymentInput {
  amountMinor: bigint | number | string;
  clientPaymentId: string;
  currency: SupportedPayoutCurrency;
  destinationToken: string;
}

export interface HyperwalletPayment {
  status: string;
  token: string;
}

export interface HyperwalletNotification {
  clientPaymentId: string | null;
  createdOn: Date | null;
  destinationToken: string | null;
  objectStatus: string | null;
  objectToken: string | null;
  token: string;
  type: string;
  userToken: string | null;
}

export interface HyperwalletClient {
  createPayment(
    input: CreateHyperwalletPaymentInput,
  ): Promise<HyperwalletPayment>;
  createUser(input: CreateHyperwalletUserInput): Promise<HyperwalletUser>;
  findPaymentByClientPaymentId(
    clientPaymentId: string,
  ): Promise<HyperwalletPayment | null>;
  findUserByClientUserId(clientUserId: string): Promise<HyperwalletUser | null>;
  getPortalUrl(): string;
  retrieveWebhookNotification(token: string): Promise<HyperwalletNotification>;
}
