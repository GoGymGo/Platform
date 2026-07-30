import { Module } from '@nestjs/common';
import { LegalModule } from '../legal/legal.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  exports: [SessionsService],
  imports: [LegalModule, ProfilesModule],
  providers: [SessionsService],
})
export class SessionsModule {}
