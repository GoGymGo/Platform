import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Environment } from '../../config/environment';
import type { JsonObject } from '../../database/database.types';

export const EXPO_PUSH_CLIENT = Symbol('EXPO_PUSH_CLIENT');

export interface ExpoPushMessage {
  body: string;
  data: JsonObject;
  title: string;
  to: string;
}

export interface ExpoPushClient {
  send(
    messages: readonly ExpoPushMessage[],
  ): Promise<readonly PushSendResult[]>;
}

export type PushSendResult = {
  status: 'accepted' | 'invalid-token' | 'retryable-failure';
};

export class PushProviderError extends Error {
  readonly code = 'PUSH_PROVIDER_UNAVAILABLE';

  constructor() {
    super('The push notification provider is unavailable.');
    this.name = 'PushProviderError';
  }
}

const responseSchema = z
  .object({
    data: z.array(
      z.discriminatedUnion('status', [
        z
          .object({ id: z.string().min(1).max(512), status: z.literal('ok') })
          .strict(),
        z
          .object({
            details: z
              .object({ error: z.string().min(1).max(120) })
              .strict()
              .optional(),
            message: z.string().min(1).max(1_024),
            status: z.literal('error'),
          })
          .strict(),
      ]),
    ),
  })
  .strict();

@Injectable()
export class ExpoHttpPushClient implements ExpoPushClient {
  private readonly accessToken: string | undefined;
  private readonly apiUrl: string;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.accessToken = config.get('EXPO_PUSH_ACCESS_TOKEN', { infer: true });
    this.apiUrl = config.get('EXPO_PUSH_API_URL', { infer: true });
  }

  async send(
    messages: readonly ExpoPushMessage[],
  ): Promise<readonly PushSendResult[]> {
    if (messages.length < 1 || messages.length > 100) {
      throw new PushProviderError();
    }
    let response: Response;
    try {
      response = await this.fetcher(this.apiUrl, {
        body: JSON.stringify(messages),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
        },
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PushProviderError();
    }
    if (!response.ok) {
      throw new PushProviderError();
    }

    try {
      const result = responseSchema.parse(await response.json());
      if (result.data.length !== messages.length) {
        throw new PushProviderError();
      }
      return result.data.map((ticket): PushSendResult => {
        if (ticket.status === 'ok') return { status: 'accepted' };
        return {
          status:
            ticket.details?.error === 'DeviceNotRegistered'
              ? 'invalid-token'
              : 'retryable-failure',
        };
      });
    } catch {
      throw new PushProviderError();
    }
  }
}

@Injectable()
export class DisabledExpoPushClient implements ExpoPushClient {
  send(): Promise<readonly PushSendResult[]> {
    return Promise.reject(
      new ServiceUnavailableException({
        code: 'PUSH_PROVIDER_UNAVAILABLE',
        message: 'Push notifications are disabled in this environment.',
      }),
    );
  }
}

export function createExpoPushClient(
  config: ConfigService<Environment, true>,
): ExpoPushClient {
  return config.get('PUSH_NOTIFICATIONS_ENABLED', { infer: true })
    ? new ExpoHttpPushClient(config)
    : new DisabledExpoPushClient();
}
