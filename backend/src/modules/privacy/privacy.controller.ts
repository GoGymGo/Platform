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
  CreatePrivacyRequestDto,
  PrivacyDownloadActionDto,
  PrivacyRequestResponseDto,
} from './dto/privacy-request.dto';
import { PrivacyService } from './privacy.service';

@ApiTags('privacy requests')
@ApiBearerAuth('firebase')
@Controller('me/privacy-requests')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Request an account data export or deletion' })
  @ApiCreatedResponse({ type: PrivacyRequestResponseDto })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatePrivacyRequestDto,
  ): Promise<PrivacyRequestResponseDto> {
    return this.privacy.createRequest(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List this account privacy requests' })
  @ApiOkResponse({ isArray: true, type: PrivacyRequestResponseDto })
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PrivacyRequestResponseDto[]> {
    return this.privacy.listRequests(principal);
  }

  @Post(':privacyRequestId/download-action')
  @ApiOperation({ summary: 'Create a short-lived private export download URL' })
  @ApiOkResponse({ type: PrivacyDownloadActionDto })
  downloadAction(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('privacyRequestId', ParseUUIDPipe) privacyRequestId: string,
  ): Promise<PrivacyDownloadActionDto> {
    return this.privacy.createDownloadAction(principal, privacyRequestId);
  }
}
