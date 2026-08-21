import {
  Body,
  Controller,
  Delete,
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
  AvatarStateResponseDto,
  AvatarCapabilitiesResponseDto,
  AvatarUploadCompletionResponseDto,
  CreateAvatarUploadDto,
  CreateAvatarUploadResponseDto,
  RemoveAvatarResponseDto,
} from './dto/profile-media.dto';
import { ProfileMediaService } from './profile-media.service';

@ApiTags('profiles')
@ApiBearerAuth('firebase')
@Controller('me')
export class ProfileMediaController {
  constructor(private readonly profileMedia: ProfileMediaService) {}

  @Post('avatar-upload')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Create an exact-size private avatar upload action',
  })
  @ApiCreatedResponse({ type: CreateAvatarUploadResponseDto })
  createUpload(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateAvatarUploadDto,
  ): Promise<CreateAvatarUploadResponseDto> {
    return this.profileMedia.createUpload(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Get('avatar/capabilities')
  @ApiOperation({ summary: 'Get authoritative avatar upload availability' })
  @ApiOkResponse({ type: AvatarCapabilitiesResponseDto })
  getCapabilities(): AvatarCapabilitiesResponseDto {
    return this.profileMedia.getCapabilities();
  }

  @Post('avatar-upload/:mediaId/complete')
  @ApiOperation({ summary: 'Verify a private avatar upload for moderation' })
  @ApiOkResponse({ type: AvatarUploadCompletionResponseDto })
  completeUpload(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<AvatarUploadCompletionResponseDto> {
    return this.profileMedia.completeUpload(principal, mediaId);
  }

  @Get('avatar')
  @ApiOperation({ summary: 'Get private owner avatar and moderation state' })
  @ApiOkResponse({ type: AvatarStateResponseDto })
  getAvatar(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AvatarStateResponseDto> {
    return this.profileMedia.getAvatar(principal);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove active and pending avatar media' })
  @ApiOkResponse({ type: RemoveAvatarResponseDto })
  removeAvatar(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RemoveAvatarResponseDto> {
    return this.profileMedia.removeAvatar(principal);
  }
}
