import { Module } from '@nestjs/common';
import { PayoutsModule } from '../payouts/payouts.module';
import { DrawsService } from './draws.service';

@Module({
  exports: [DrawsService],
  imports: [PayoutsModule],
  providers: [DrawsService],
})
export class DrawsModule {}
