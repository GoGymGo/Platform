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
  DecideProfileMediaDto,
  DecidePrivacyRequestDto,
  DecideRegionVerificationDto,
  DrawLockResponseDto,
  LockDrawDto,
  OperatorActionResponseDto,
  ProfileMediaReviewActionDto,
  SessionEvidenceReviewResponseDto,
  OperatorSystemHealthResponseDto,
  OperatorWorkQueueItemDto,
  RejectSessionDto,
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

  @Get('system-health')
  @ApiOperation({ summary: 'Inspect worker heartbeat and durable queue depth' })
  @ApiOkResponse({ type: OperatorSystemHealthResponseDto })
  getSystemHealth(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorSystemHealthResponseDto> {
    return this.operator.getSystemHealth(principal);
  }

  @Get('sessions/:sessionId/review')
  @ApiOperation({
    summary: 'Get a privacy-minimized, server-bound session evidence review',
  })
  @ApiOkResponse({ type: SessionEvidenceReviewResponseDto })
  getSessionEvidenceReview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<SessionEvidenceReviewResponseDto> {
    return this.operator.getSessionEvidenceReview(principal, sessionId);
  }

  @Post('sessions/:sessionId/reject')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Reject a reviewed workout session' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  rejectSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RejectSessionDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.rejectSession(
      principal,
      sessionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
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
  @ApiOkResponse({ type: DrawLockResponseDto })
  lockDraw(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: LockDrawDto,
  ): Promise<DrawLockResponseDto> {
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

  @Get('profile-media/:mediaId/review-action')
  @ApiOperation({
    summary: 'Create a short-lived private avatar review action',
  })
  @ApiOkResponse({ type: ProfileMediaReviewActionDto })
  getProfileMediaReviewAction(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<ProfileMediaReviewActionDto> {
    return this.operator.getProfileMediaReviewAction(principal, mediaId);
  }

  @Post('profile-media/:mediaId/decision')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Approve or reject moderated avatar media' })
  @ApiOkResponse({ type: OperatorActionResponseDto })
  decideProfileMedia(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DecideProfileMediaDto,
  ): Promise<OperatorActionResponseDto> {
    return this.operator.decideProfileMedia(
      principal,
      mediaId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}
