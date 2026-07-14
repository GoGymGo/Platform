import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { HyperwalletModule } from './hyperwallet/hyperwallet.module';
import {
  OperatorPayoutsController,
  OperatorPayoutReleaseControlController,
  PayoutsController,
} from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { PayoutReleaseControlService } from './payout-release-control.service';
import { HyperwalletWebhookGuard } from './webhooks/hyperwallet-webhook.guard';
import { HyperwalletWebhooksController } from './webhooks/hyperwallet-webhooks.controller';
import { HyperwalletWebhooksService } from './webhooks/hyperwallet-webhooks.service';

@Module({
  controllers: [
    HyperwalletWebhooksController,
    OperatorPayoutReleaseControlController,
    OperatorPayoutsController,
    PayoutsController,
  ],
  exports: [HyperwalletWebhooksService, PayoutsService],
  imports: [
    AdminAuthorizationModule,
    HyperwalletModule,
    NotificationsModule,
    ProfilesModule,
  ],
  providers: [
    HyperwalletWebhookGuard,
    HyperwalletWebhooksService,
    PayoutReleaseControlService,
    PayoutsService,
  ],
})
export class PayoutsModule {}
