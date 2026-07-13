import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { Environment } from '../../config/environment';
import { AuthGuard } from './auth.guard';
import {
  ACCOUNT_IDENTITY_ADMIN,
  UnavailableAccountIdentityAdmin,
} from './account-identity-admin';
import { TOKEN_VERIFIER } from './auth.types';
import { FirebaseAccountIdentityAdmin } from './firebase-account-identity-admin';
import { FirebaseTokenVerifier } from './firebase-token-verifier';
import { TestTokenVerifier } from './test-token-verifier';

@Global()
@Module({
  exports: [ACCOUNT_IDENTITY_ADMIN],
  providers: [
    {
      inject: [ConfigService],
      provide: ACCOUNT_IDENTITY_ADMIN,
      useFactory: (config: ConfigService<Environment, true>) =>
        config.get('AUTH_MODE', { infer: true }) === 'firebase'
          ? new FirebaseAccountIdentityAdmin(config)
          : new UnavailableAccountIdentityAdmin(),
    },
    {
      inject: [ConfigService],
      provide: TOKEN_VERIFIER,
      useFactory: (config: ConfigService<Environment, true>) =>
        config.get('AUTH_MODE', { infer: true }) === 'test'
          ? new TestTokenVerifier()
          : new FirebaseTokenVerifier(config),
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
