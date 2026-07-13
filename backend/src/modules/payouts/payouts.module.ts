import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HyperwalletModule } from './hyperwallet/hyperwallet.module';
import {
  OperatorPayoutsController,
  PayoutsController,
} from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { HyperwalletWebhookGuard } from './webhooks/hyperwallet-webhook.guard';
import { HyperwalletWebhooksController } from './webhooks/hyperwallet-webhooks.controller';
import { HyperwalletWebhooksService } from './webhooks/hyperwallet-webhooks.service';

@Module({
  controllers: [
    HyperwalletWebhooksController,
    OperatorPayoutsController,
    PayoutsController,
  ],
  exports: [HyperwalletWebhooksService, PayoutsService],
  imports: [HyperwalletModule, NotificationsModule, ProfilesModule],
  providers: [
    HyperwalletWebhookGuard,
    HyperwalletWebhooksService,
    PayoutsService,
  ],
})
export class PayoutsModule {}
