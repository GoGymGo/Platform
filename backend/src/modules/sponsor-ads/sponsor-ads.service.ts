import { Injectable } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CompetitionsService } from '../competitions/competitions.service';
import type { SponsorAdPlacementInventoryResponseDto } from './dto/sponsor-ad-placement.dto';
import { buildSponsorAdPlacementInventory } from './sponsor-ad-placements';

@Injectable()
export class SponsorAdsService {
  constructor(private readonly competitions: CompetitionsService) {}

  async getMyPlacementInventory(
    principal: AuthenticatedPrincipal,
  ): Promise<SponsorAdPlacementInventoryResponseDto> {
    const enrollment = await this.competitions.getCurrentEnrollment(principal);

    return buildSponsorAdPlacementInventory(enrollment?.competitionId ?? null);
  }
}
