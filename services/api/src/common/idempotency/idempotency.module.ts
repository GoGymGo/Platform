import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  exports: [IdempotencyService],
  providers: [IdempotencyService],
})
export class IdempotencyModule {}
