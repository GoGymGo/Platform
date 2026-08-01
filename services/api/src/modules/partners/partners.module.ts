import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  controllers: [PartnersController],
  imports: [ProfilesModule],
  providers: [PartnersService],
})
export class PartnersModule {}
