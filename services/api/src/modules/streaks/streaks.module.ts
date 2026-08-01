import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { StreaksController } from './streaks.controller';
import { StreaksService } from './streaks.service';

@Module({
  controllers: [StreaksController],
  imports: [ProfilesModule],
  providers: [StreaksService],
})
export class StreaksModule {}
