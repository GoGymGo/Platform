import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { SponsorAdPlacementInventoryResponseDto } from './dto/sponsor-ad-placement.dto';
import { SponsorAdsService } from './sponsor-ads.service';

@ApiTags('sponsor ads')
@ApiBearerAuth('firebase')
@Controller('me/sponsor-ad-placements')
export class SponsorAdsController {
  constructor(private readonly sponsorAds: SponsorAdsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Return non-delivering sponsor placement placeholders and enrollment eligibility',
  })
  @ApiOkResponse({ type: SponsorAdPlacementInventoryResponseDto })
  getMyPlacementInventory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SponsorAdPlacementInventoryResponseDto> {
    return this.sponsorAds.getMyPlacementInventory(principal);
  }
}
