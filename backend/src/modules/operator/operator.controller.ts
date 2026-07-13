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
  DecidePartnerApplicationDto,
  DecidePrivacyRequestDto,
  DecideRegionVerificationDto,
  LockDrawDto,
  OperatorActionResponseDto,
  OperatorWorkQueueItemDto,
  SettleDrawDto,
  VerifySessionDto,
} from './dto/operator.dto';
import { OperatorService } from './operator.service';

@ApiTags('operator')
@ApiBearerAuth('firebase')
@Controller('operator')
export class OperatorController {
  constructor(private readonly operator: OperatorService) {}

  @Get('work-queue')
  @ApiOperation({ summary: 'List review work without sensitive evidence data' })
  @ApiOkResponse({ isArray: true, type: OperatorWorkQueueItemDto })
  listWorkQueue(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorWorkQueueItemDto[]> {
    return this.operator.listWorkQueue(principal);
  }

  @Post('sessions/:sessionId/verify')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Manually verify a reviewed workout session' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  verifySession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: VerifySessionDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.verifySession(
      principal,
      sessionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('draws/lock')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Lock a competition draw snapshot and commitment' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  lockDraw(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: LockDrawDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.lockDraw(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('draws/:drawId/settle')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Reveal the draw seed and settle winners' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  settleDraw(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('drawId', ParseUUIDPipe) drawId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: SettleDrawDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.settleDraw(
      principal,
      drawId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('region-verifications/:verificationId/decision')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Approve or reject a region-verification review' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  decideRegion(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DecideRegionVerificationDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.decideRegionVerification(
      principal,
      verificationId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('partner-applications/:applicationId/decision')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Review a partner application' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  decidePartner(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DecidePartnerApplicationDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.decidePartnerApplication(
      principal,
      applicationId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('privacy-requests/:privacyRequestId/decision')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Start or reject a privacy request' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  decidePrivacy(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('privacyRequestId', ParseUUIDPipe) privacyRequestId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DecidePrivacyRequestDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.decidePrivacyRequest(
      principal,
      privacyRequestId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}
