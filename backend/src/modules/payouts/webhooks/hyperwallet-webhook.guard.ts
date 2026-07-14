import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { Environment } from '../../../config/environment';

export function basicCredentialsMatch(
  authorization: string | undefined,
  expectedUsername: string,
  expectedPassword: string,
): boolean {
  if (!authorization?.startsWith('Basic ')) {
    return false;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 1) {
    return false;
  }

  const supplied = Buffer.from(decoded);
  const expected = Buffer.from(`${expectedUsername}:${expectedPassword}`);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

@Injectable()
export class HyperwalletWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.get('HYPERWALLET_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException({
        code: 'PAYOUT_PROVIDER_UNAVAILABLE',
        message: 'The payout provider is not configured in this environment.',
      });
    }

    const username = this.config.get('HYPERWALLET_WEBHOOK_USERNAME', {
      infer: true,
    });
    const password = this.config.get('HYPERWALLET_WEBHOOK_PASSWORD', {
      infer: true,
    });
    const request = context.switchToHttp().getRequest<Request>();
    if (
      !username ||
      !password ||
      !basicCredentialsMatch(
        request.header('authorization'),
        username,
        password,
      )
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_PROVIDER_WEBHOOK_AUTH',
        message: 'Provider webhook authentication failed.',
      });
    }

    return true;
  }
}
