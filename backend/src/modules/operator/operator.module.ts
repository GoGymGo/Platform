import { Module } from '@nestjs/common';
import { DrawsModule } from '../draws/draws.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';

@Module({
  controllers: [OperatorController],
  imports: [DrawsModule, ProfilesModule, SessionsModule],
  providers: [OperatorService],
})
export class OperatorModule {}
