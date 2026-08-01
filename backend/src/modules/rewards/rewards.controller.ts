import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { Public } from '../auth/public.decorator';
import {
  ClaimRewardResponseDto,
  RewardAwardResponseDto,
  RewardCatalogItemResponseDto,
  RewardCatalogQueryDto,
} from './dto/reward.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('catalog')
  @Public()
  @ApiOperation({ summary: 'List published contest rewards for a region' })
  @ApiOkResponse({ isArray: true, type: RewardCatalogItemResponseDto })
  getCatalog(
    @Query() query: RewardCatalogQueryDto,
  ): Promise<RewardCatalogItemResponseDto[]> {
    return this.rewards.getCatalog(query.region, query.monthKey);
  }

  @Get('awards/me')
  @ApiBearerAuth('firebase')
  @ApiOperation({ summary: 'List the authenticated user reward awards' })
  @ApiOkResponse({ isArray: true, type: RewardAwardResponseDto })
  getMyAwards(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RewardAwardResponseDto[]> {
    return this.rewards.getMyAwards(principal);
  }

  @Post('awards/:awardId/claim')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Claim an awarded physical prize or coupon code' })
  @ApiOkResponse({ type: ClaimRewardResponseDto })
  claim(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('awardId', ParseUUIDPipe) awardId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<ClaimRewardResponseDto> {
    return this.rewards.claim(
      principal,
      awardId,
      requireIdempotencyKey(idempotencyKey),
    );
  }
}
