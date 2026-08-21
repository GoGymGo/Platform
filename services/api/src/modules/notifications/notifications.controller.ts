import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import {
  PushCapabilitiesResponseDto,
  PushDeviceResponseDto,
  RegisterPushDeviceDto,
} from './dto/push-device.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('push devices')
@ApiBearerAuth('firebase')
@Controller('me/push-devices')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Read push registration availability' })
  @ApiOkResponse({ type: PushCapabilitiesResponseDto })
  capabilities(): PushCapabilitiesResponseDto {
    return this.notifications.getCapabilities();
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Register an Expo push token for this account' })
  @ApiCreatedResponse({ type: PushDeviceResponseDto })
  register(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RegisterPushDeviceDto,
  ): Promise<PushDeviceResponseDto> {
    return this.notifications.registerDevice(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Delete(':deviceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disable a push token owned by this account' })
  @ApiNoContentResponse()
  disable(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
  ): Promise<void> {
    return this.notifications.disableDevice(principal, deviceId);
  }
}
