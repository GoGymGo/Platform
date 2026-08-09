import {
  Body,
  Controller,
  Delete,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import {
  AdminDeletedEntityResponseDto,
  DeleteVersionedAdminEntityDto,
} from '../operator/dto/admin-configuration.dto';
import { AdminRewardsService } from './admin-rewards.service';
import {
  AddRewardCouponCodesDto,
  AddedCouponCodesResponseDto,
  AdminRewardResponseDto,
  CreateRewardCatalogItemDto,
  RewardCatalogStatusActionDto,
  UpdateRewardCatalogItemDto,
} from './dto/reward.dto';

@ApiTags('operator-rewards')
@ApiBearerAuth('firebase')
@Controller('operator/configuration/rewards')
export class AdminRewardsController {
  constructor(private readonly rewards: AdminRewardsService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a draft contest reward' })
  @ApiCreatedResponse({ type: AdminRewardResponseDto })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateRewardCatalogItemDto,
  ): Promise<AdminRewardResponseDto> {
    return this.rewards.create(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Put(':rewardId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Replace a draft contest reward' })
  @ApiOkResponse({ type: AdminRewardResponseDto })
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('rewardId', ParseUUIDPipe) rewardId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: UpdateRewardCatalogItemDto,
  ): Promise<AdminRewardResponseDto> {
    return this.rewards.update(
      principal,
      rewardId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post(':rewardId/status-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Publish or archive a contest reward' })
  @ApiOkResponse({ type: AdminRewardResponseDto })
  changeStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('rewardId', ParseUUIDPipe) rewardId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RewardCatalogStatusActionDto,
  ): Promise<AdminRewardResponseDto> {
    return this.rewards.changeStatus(
      principal,
      rewardId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Delete(':rewardId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Delete an inactive reward from the admin dashboard',
  })
  @ApiOkResponse({ type: AdminDeletedEntityResponseDto })
  delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('rewardId', ParseUUIDPipe) rewardId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.rewards.delete(
      principal,
      rewardId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post(':rewardId/coupon-codes')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Upload encrypted coupon-code inventory' })
  @ApiCreatedResponse({ type: AddedCouponCodesResponseDto })
  addCouponCodes(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('rewardId', ParseUUIDPipe) rewardId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: AddRewardCouponCodesDto,
  ): Promise<AddedCouponCodesResponseDto> {
    return this.rewards.addCouponCodes(
      principal,
      rewardId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}
