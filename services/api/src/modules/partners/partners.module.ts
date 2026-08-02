import { Module } from '@nestjs/common';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { ProfilesModule } from '../profiles/profiles.module';
import {
  PartnerOperatorController,
  PartnersController,
} from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  controllers: [PartnerOperatorController, PartnersController],
  imports: [AdminAuthorizationModule, ProfilesModule],
  providers: [PartnersService],
})
export class PartnersModule {}
