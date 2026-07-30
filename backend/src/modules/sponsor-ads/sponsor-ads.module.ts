import { Module } from '@nestjs/common';
import { CompetitionsModule } from '../competitions/competitions.module';
import { SponsorAdsController } from './sponsor-ads.controller';
import { SponsorAdsService } from './sponsor-ads.service';

@Module({
  controllers: [SponsorAdsController],
  imports: [CompetitionsModule],
  providers: [SponsorAdsService],
})
export class SponsorAdsModule {}
