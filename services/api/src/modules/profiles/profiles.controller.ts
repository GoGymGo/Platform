import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { MeResponseDto, UpdateMeDto } from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth('firebase')
@Controller('me')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOperation({
    summary: 'Bootstrap and return the authenticated account profile',
  })
  @ApiOkResponse({ type: MeResponseDto })
  getMe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MeResponseDto> {
    return this.profiles.getMe(principal);
  }

  @Patch()
  @ApiOperation({
    summary:
      'Update the authenticated account public identity and privacy settings',
  })
  @ApiOkResponse({ type: MeResponseDto })
  updateMe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() update: UpdateMeDto,
  ): Promise<MeResponseDto> {
    return this.profiles.updateMe(principal, update);
  }
}
