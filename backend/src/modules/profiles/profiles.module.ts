import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  controllers: [ProfilesController],
  exports: [ProfilesService],
  providers: [ProfilesService],
})
export class ProfilesModule {}
