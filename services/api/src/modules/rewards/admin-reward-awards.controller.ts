import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { AdminRewardAwardsService } from './admin-reward-awards.service';
import {
  AdminRewardAwardResponseDto,
  RewardAwardStatusActionDto,
} from './dto/reward.dto';

@ApiTags('operator-reward-awards')
@ApiBearerAuth('firebase')
@Controller('operator/reward-awards')
export class AdminRewardAwardsController {
  constructor(private readonly awards: AdminRewardAwardsService) {}

  @Post(':awardId/status-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Cancel, fulfill, or redeem a reward award' })
  @ApiOkResponse({ type: AdminRewardAwardResponseDto })
  changeStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('awardId', ParseUUIDPipe) awardId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RewardAwardStatusActionDto,
  ): Promise<AdminRewardAwardResponseDto> {
    return this.awards.changeStatus(
      principal,
      awardId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}
