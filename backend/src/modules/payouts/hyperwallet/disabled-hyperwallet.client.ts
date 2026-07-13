import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  HyperwalletClient,
  HyperwalletNotification,
  HyperwalletPayment,
  HyperwalletUser,
} from './hyperwallet.types';

@Injectable()
export class DisabledHyperwalletClient implements HyperwalletClient {
  createPayment(): Promise<HyperwalletPayment> {
    return Promise.reject(this.disabled());
  }

  createUser(): Promise<HyperwalletUser> {
    return Promise.reject(this.disabled());
  }

  findPaymentByClientPaymentId(): Promise<HyperwalletPayment | null> {
    return Promise.reject(this.disabled());
  }

  findUserByClientUserId(): Promise<HyperwalletUser | null> {
    return Promise.reject(this.disabled());
  }

  getPortalUrl(): string {
    throw this.disabled();
  }

  retrieveWebhookNotification(): Promise<HyperwalletNotification> {
    return Promise.reject(this.disabled());
  }

  private disabled(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'PAYOUT_PROVIDER_UNAVAILABLE',
      message: 'The payout provider is not configured in this environment.',
    });
  }
}
