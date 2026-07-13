import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';

@Module({
  controllers: [CompetitionsController],
  exports: [CompetitionsService],
  imports: [ProfilesModule],
  providers: [CompetitionsService],
})
export class CompetitionsModule {}
