import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment';
import { DisabledHyperwalletClient } from './disabled-hyperwallet.client';
import { HyperwalletHttpClient } from './hyperwallet-http.client';
import { HYPERWALLET_CLIENT } from './hyperwallet.types';

@Module({
  exports: [HYPERWALLET_CLIENT],
  providers: [
    {
      inject: [ConfigService],
      provide: HYPERWALLET_CLIENT,
      useFactory: (config: ConfigService<Environment, true>) =>
        config.get('HYPERWALLET_ENABLED', { infer: true })
          ? new HyperwalletHttpClient(config)
          : new DisabledHyperwalletClient(),
    },
  ],
})
export class HyperwalletModule {}
