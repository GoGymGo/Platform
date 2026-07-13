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
  send(messages: readonly ExpoPushMessage[]): Promise<void>;
}

const responseSchema = z.object({
  data: z.array(
    z.object({
      message: z.string().optional(),
      status: z.enum(['error', 'ok']),
    }),
  ),
});

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

  async send(messages: readonly ExpoPushMessage[]): Promise<void> {
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
      throw this.unavailable();
    }
    if (!response.ok) {
      throw this.unavailable();
    }

    try {
      const result = responseSchema.parse(await response.json());
      if (result.data.some((ticket) => ticket.status === 'error')) {
        throw this.unavailable();
      }
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'PUSH_PROVIDER_UNAVAILABLE',
      message: 'The push notification provider is unavailable.',
    });
  }
}

@Injectable()
export class DisabledExpoPushClient implements ExpoPushClient {
  send(): Promise<void> {
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
