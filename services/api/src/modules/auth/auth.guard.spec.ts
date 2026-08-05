import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, extractBearerToken } from './auth.guard';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: {
    header: (name: string) => string | undefined;
    principal?: AuthenticatedPrincipal;
  };
} {
  const request = {
    header: (name: string) =>
      name === 'authorization' ? authorization : undefined,
  };
  const context = {
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('authentication guard', () => {
  it('accepts exactly one bearer token', () => {
    expect(extractBearerToken('Bearer firebase-token')).toBe('firebase-token');
    expect(extractBearerToken('Basic credentials')).toBeNull();
    expect(extractBearerToken('Bearer token with spaces')).toBeNull();
  });

  it('rejects an unauthenticated protected request', async () => {
    const verifier = { verifyIdToken: jest.fn() } as TokenVerifier;
    const guard = new AuthGuard(new Reflector(), verifier);

    await expect(
      guard.canActivate(createContext().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches only the verifier-derived principal', async () => {
    const principal: AuthenticatedPrincipal = {
      email: 'verified@example.com',
      emailVerified: true,
      firebaseUid: 'firebase-uid',
      roles: ['user'],
      signInProvider: 'password',
      tokenIssuedAt: 1,
    };
    const verifyIdToken = jest.fn().mockResolvedValue(principal);
    const verifier: TokenVerifier = { verifyIdToken };
    const guard = new AuthGuard(new Reflector(), verifier);
    const { context, request } = createContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual(principal);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
  });
});
