import {
  Body,
  Controller,
  Get,
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
import {
  OperatorPayoutActionDto,
  OperatorPayoutClaimReviewDto,
  OperatorPayoutClaimResponseDto,
  PayoutClaimResponseDto,
  PortalActionResponseDto,
} from './dto/payout.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('payouts')
@ApiBearerAuth('firebase')
@Controller('payout-claims')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the current approved winner payout claim' })
  @ApiOkResponse({ type: PayoutClaimResponseDto })
  getMyClaim(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayoutClaimResponseDto | null> {
    return this.payouts.getMyClaim(principal);
  }

  @Post(':claimId/portal-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Provision hosted payee setup and return the approved portal URL',
  })
  @ApiOkResponse({ type: PortalActionResponseDto })
  openPortal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<PortalActionResponseDto> {
    return this.payouts.openPortal(
      principal,
      claimId,
      requireIdempotencyKey(idempotencyKey),
    );
  }
}

@ApiTags('operator payouts')
@ApiBearerAuth('firebase')
@Controller('operator/payout-claims')
export class OperatorPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get(':claimId/review')
  @ApiOperation({
    summary: 'Get a privacy-safe authoritative payout claim review',
  })
  @ApiOkResponse({ type: OperatorPayoutClaimReviewDto })
  getReview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ): Promise<OperatorPayoutClaimReviewDto> {
    return this.payouts.getOperatorReview(principal, claimId);
  }

  @Post(':claimId/approve')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Approve a reviewed winner claim for payee setup' })
  @ApiOkResponse({ type: OperatorPayoutClaimResponseDto })
  approve(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: OperatorPayoutActionDto,
  ): Promise<OperatorPayoutClaimResponseDto> {
    return this.payouts.approve(
      principal,
      claimId,
      requireIdempotencyKey(idempotencyKey),
      request.expectedVersion,
      request.reason,
    );
  }

  @Post(':claimId/release')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Release a ready claim to Hyperwallet exactly once',
  })
  @ApiOkResponse({ type: OperatorPayoutClaimResponseDto })
  release(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: OperatorPayoutActionDto,
  ): Promise<OperatorPayoutClaimResponseDto> {
    return this.payouts.release(
      principal,
      claimId,
      requireIdempotencyKey(idempotencyKey),
      request.expectedVersion,
      request.reason,
    );
  }
}
