import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedPrincipal, TokenVerifier } from './auth.types';

export class TestTokenVerifier implements TokenVerifier {
  verifyIdToken(token: string): Promise<AuthenticatedPrincipal> {
    const [scheme, firebaseUid, email = 'tester@example.com'] =
      token.split(':');
    if (scheme !== 'test' || !firebaseUid || firebaseUid.length > 128) {
      throw new UnauthorizedException({
        code: 'INVALID_TEST_TOKEN',
        message: 'The test authentication token is invalid.',
      });
    }

    return Promise.resolve({
      email,
      emailVerified: true,
      firebaseUid,
      roles: ['user'],
      tokenIssuedAt: Math.floor(Date.now() / 1_000),
    });
  }
}
