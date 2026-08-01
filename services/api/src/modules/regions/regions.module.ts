import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';

@Module({
  controllers: [RegionsController],
  imports: [ProfilesModule],
  providers: [RegionsService],
})
export class RegionsModule {}
