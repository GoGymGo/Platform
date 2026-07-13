import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { Environment } from '../../config/environment';
import { AuthGuard } from './auth.guard';
import { TOKEN_VERIFIER } from './auth.types';
import { FirebaseTokenVerifier } from './firebase-token-verifier';
import { TestTokenVerifier } from './test-token-verifier';

@Global()
@Module({
  providers: [
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
