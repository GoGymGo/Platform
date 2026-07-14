import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  CreateRegionVerificationDto,
  RegionPolicyResponseDto,
  RegionVerificationResponseDto,
} from './dto/region.dto';
import { RegionsService } from './regions.service';

@ApiTags('regions')
@Controller()
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get('regions')
  @Public()
  @ApiOperation({ summary: 'List active versioned service-region policies' })
  @ApiOkResponse({ isArray: true, type: RegionPolicyResponseDto })
  listRegions(): Promise<RegionPolicyResponseDto[]> {
    return this.regions.listRegions();
  }

  @Post('me/region-verifications')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Submit minimized regional eligibility evidence for server review',
  })
  @ApiCreatedResponse({ type: RegionVerificationResponseDto })
  createVerification(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreateRegionVerificationDto,
  ): Promise<RegionVerificationResponseDto> {
    return this.regions.createVerification(
      principal,
      requireIdempotencyKey(idempotencyKey),
      request,
    );
  }
}
