import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { Public } from '../auth/public.decorator';
import {
  CreatorApplicationDto,
  GymApplicationDto,
  OperatorPartnerApplicationDto,
  PartnerApplicationResponseDto,
  SponsorApplicationDto,
} from './dto/partner-application.dto';
import { PartnersService } from './partners.service';

@ApiTags('partner applications')
@Controller('partner-applications')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Post('creators')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Submit an authenticated creator application' })
  @ApiCreatedResponse({ type: PartnerApplicationResponseDto })
  submitCreator(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatorApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    return this.partners.submitCreator(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('sponsors')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Submit a public sponsor inquiry' })
  @ApiCreatedResponse({ type: PartnerApplicationResponseDto })
  submitSponsor(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: SponsorApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    return this.partners.submitSponsor(
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('gyms')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Submit a public partner-gym inquiry' })
  @ApiCreatedResponse({ type: PartnerApplicationResponseDto })
  submitGym(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: GymApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    return this.partners.submitGym(
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}

@ApiTags('operator partner applications')
@ApiBearerAuth('firebase')
@Controller('operator/partner-applications')
export class PartnerOperatorController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  @ApiOperation({ summary: 'Review creator, sponsor and gym applications' })
  @ApiOkResponse({ isArray: true, type: OperatorPartnerApplicationDto })
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorPartnerApplicationDto[]> {
    return this.partners.listApplications(principal);
  }
}
