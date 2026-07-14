import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Environment } from '../../../config/environment';
import { minorUnitsToDecimal } from './money';
import type {
  CreateHyperwalletPaymentInput,
  CreateHyperwalletUserInput,
  HyperwalletClient,
  HyperwalletNotification,
  HyperwalletPayment,
  HyperwalletUser,
} from './hyperwallet.types';

type Fetcher = typeof fetch;

const tokenStatusSchema = z.object({
  status: z.string().min(1),
  token: z.string().min(1),
});

const userListSchema = z.object({
  data: z.array(tokenStatusSchema).default([]),
});

const notificationSchema = z
  .object({
    createdOn: z.string().optional(),
    data: z
      .object({
        clientPaymentId: z.string().optional(),
        destinationToken: z.string().optional(),
        status: z.string().optional(),
        token: z.string().optional(),
        userToken: z.string().optional(),
      })
      .passthrough()
      .optional(),
    token: z.string().min(1),
    type: z.string().min(1),
  })
  .passthrough();

@Injectable()
export class HyperwalletHttpClient implements HyperwalletClient {
  private readonly apiUrl: string;
  private readonly authorization: string;
  private readonly portalUrl: string;
  private readonly programToken: string;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.apiUrl = config
      .get('HYPERWALLET_API_URL', { infer: true })
      .replace(/\/$/, '');
    this.portalUrl = this.requireConfig(config, 'HYPERWALLET_PORTAL_URL');
    this.programToken = this.requireConfig(config, 'HYPERWALLET_PROGRAM_TOKEN');
    const username = this.requireConfig(config, 'HYPERWALLET_USERNAME');
    const password = this.requireConfig(config, 'HYPERWALLET_PASSWORD');
    this.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  async findUserByClientUserId(
    clientUserId: string,
  ): Promise<HyperwalletUser | null> {
    const query = new URLSearchParams({
      clientUserId,
      programToken: this.programToken,
    });
    const response = await this.request('GET', `/users?${query.toString()}`);
    const users = userListSchema.parse(response).data;
    return users[0] ?? null;
  }

  async findPaymentByClientPaymentId(
    clientPaymentId: string,
  ): Promise<HyperwalletPayment | null> {
    const query = new URLSearchParams({
      clientPaymentId,
      programToken: this.programToken,
    });
    const response = await this.request('GET', `/payments?${query.toString()}`);
    const payments = userListSchema.parse(response).data;
    return payments[0] ?? null;
  }

  async createUser(
    input: CreateHyperwalletUserInput,
  ): Promise<HyperwalletUser> {
    const response = await this.request('POST', '/users', {
      clientUserId: input.clientUserId,
      country: input.country,
      email: input.email,
      profileType: 'INDIVIDUAL',
      programToken: this.programToken,
    });
    return tokenStatusSchema.parse(response);
  }

  async createPayment(
    input: CreateHyperwalletPaymentInput,
  ): Promise<HyperwalletPayment> {
    const response = await this.request('POST', '/payments', {
      amount: minorUnitsToDecimal(input.amountMinor),
      clientPaymentId: input.clientPaymentId,
      currency: input.currency,
      destinationToken: input.destinationToken,
      programToken: this.programToken,
    });
    return tokenStatusSchema.parse(response);
  }

  getPortalUrl(): string {
    return this.portalUrl;
  }

  async retrieveWebhookNotification(
    token: string,
  ): Promise<HyperwalletNotification> {
    const response = notificationSchema.parse(
      await this.request(
        'GET',
        `/webhook-notifications/${encodeURIComponent(token)}`,
      ),
    );
    const createdOn = response.createdOn ? new Date(response.createdOn) : null;

    return {
      clientPaymentId: response.data?.clientPaymentId ?? null,
      createdOn:
        createdOn && !Number.isNaN(createdOn.getTime()) ? createdOn : null,
      destinationToken: response.data?.destinationToken ?? null,
      objectStatus: response.data?.status ?? null,
      objectToken: response.data?.token ?? null,
      token: response.token,
      type: response.type,
      userToken: response.data?.userToken ?? null,
    };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, string>,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiUrl}${path}`, {
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          Accept: 'application/json',
          Authorization: this.authorization,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        method,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'PAYOUT_PROVIDER_UNAVAILABLE',
        message: 'The payout provider could not be reached.',
      });
    }

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'PAYOUT_PROVIDER_REJECTED_REQUEST',
        message: 'The payout provider rejected the request.',
      });
    }

    try {
      return await response.json();
    } catch {
      throw new BadGatewayException({
        code: 'PAYOUT_PROVIDER_INVALID_RESPONSE',
        message: 'The payout provider returned an invalid response.',
      });
    }
  }

  private requireConfig(
    config: ConfigService<Environment, true>,
    key:
      | 'HYPERWALLET_PASSWORD'
      | 'HYPERWALLET_PORTAL_URL'
      | 'HYPERWALLET_PROGRAM_TOKEN'
      | 'HYPERWALLET_USERNAME',
  ): string {
    const value = config.get(key, { infer: true });
    if (!value) {
      throw new Error(`${key} is required for the Hyperwallet client.`);
    }
    return value;
  }
}
