import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from './auth.types';

type AuthenticatedRequest = Request & { principal?: AuthenticatedPrincipal };

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) {
      throw new Error('The authentication guard did not attach a principal.');
    }

    return request.principal;
  },
);
