import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { TOKEN_VERIFIER } from './auth.types';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';

type AuthenticatedRequest = Request & { principal?: AuthenticatedPrincipal };

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer ([^\s,]+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.header('authorization'));
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'A valid Firebase bearer token is required.',
      });
    }

    try {
      request.principal = await this.tokenVerifier.verifyIdToken(token);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException({
        code: 'INVALID_AUTH_TOKEN',
        message: 'The Firebase bearer token is invalid or expired.',
      });
    }
  }
}
