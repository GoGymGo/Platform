import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  controllers: [ResultsController],
  imports: [ProfilesModule],
  providers: [ResultsService],
})
export class ResultsModule {}
