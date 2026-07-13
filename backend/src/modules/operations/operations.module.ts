import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { OperationsWorkerService } from './operations-worker.service';

@Module({
  exports: [OperationsWorkerService],
  imports: [NotificationsModule, PayoutsModule],
  providers: [OperationsWorkerService],
})
export class OperationsModule {}
