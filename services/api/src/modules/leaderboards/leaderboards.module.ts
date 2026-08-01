import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  controllers: [LeaderboardsController],
  imports: [ProfilesModule],
  providers: [LeaderboardsService],
})
export class LeaderboardsModule {}
