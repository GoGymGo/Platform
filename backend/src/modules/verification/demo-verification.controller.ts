import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { DemoVerificationService } from './demo-verification.service';
import {
  CreateDemoCheckInDto,
  DemoCheckInResponseDto,
} from './dto/demo-check-in.dto';

@ApiTags('demo-verification')
@ApiBearerAuth('firebase')
@Controller('demo-verifications')
export class DemoVerificationController {
  constructor(private readonly verification: DemoVerificationService) {}

  @Post('check-ins')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary:
      'Create a non-eligible Canada demo checkpoint without collecting evidence',
  })
  @ApiCreatedResponse({ type: DemoCheckInResponseDto })
  createCheckIn(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreateDemoCheckInDto,
  ): Promise<DemoCheckInResponseDto> {
    return this.verification.createCheckIn(
      principal,
      requireIdempotencyKey(idempotencyKey),
      request,
    );
  }
}
