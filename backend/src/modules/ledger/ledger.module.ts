import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

@Global()
@Module({
  exports: [LedgerService],
  providers: [LedgerService],
})
export class LedgerModule {}
