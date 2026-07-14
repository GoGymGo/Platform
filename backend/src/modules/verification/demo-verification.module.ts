import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { DemoVerificationController } from './demo-verification.controller';
import { DemoVerificationService } from './demo-verification.service';

@Module({
  controllers: [DemoVerificationController],
  imports: [ProfilesModule],
  providers: [DemoVerificationService],
})
export class DemoVerificationModule {}
