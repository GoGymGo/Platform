import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../auth/public.decorator';
import {
  HyperwalletWebhookAcceptedDto,
  HyperwalletWebhookDto,
} from './hyperwallet-webhook.dto';
import { HyperwalletWebhookGuard } from './hyperwallet-webhook.guard';
import { HyperwalletWebhooksService } from './hyperwallet-webhooks.service';

@ApiTags('provider webhooks')
@ApiBasicAuth('hyperwallet-webhook')
@Controller('webhooks/hyperwallet')
export class HyperwalletWebhooksController {
  constructor(private readonly webhooks: HyperwalletWebhooksService) {}

  @Post()
  @Public()
  @UseGuards(HyperwalletWebhookGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Durably accept a Hyperwallet notification for reconciliation',
  })
  @ApiOkResponse({ type: HyperwalletWebhookAcceptedDto })
  async receive(
    @Body() webhook: HyperwalletWebhookDto,
  ): Promise<HyperwalletWebhookAcceptedDto> {
    await this.webhooks.receive(webhook);
    return { accepted: true };
  }
}
