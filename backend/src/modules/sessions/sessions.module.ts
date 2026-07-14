import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  exports: [SessionsService],
  imports: [ProfilesModule],
  providers: [SessionsService],
})
export class SessionsModule {}
