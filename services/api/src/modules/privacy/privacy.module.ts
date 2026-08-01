import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { PrivateObjectStorageModule } from '../storage/private-object-storage.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyExportBuilder } from './privacy-export.builder';
import { PrivacyOperationsRepository } from './privacy-operations.repository';
import { PrivacyOperationsService } from './privacy-operations.service';
import { PrivacyService } from './privacy.service';

@Module({
  controllers: [PrivacyController],
  exports: [PrivacyOperationsService],
  imports: [PrivateObjectStorageModule, ProfilesModule],
  providers: [
    PrivacyExportBuilder,
    PrivacyOperationsRepository,
    PrivacyOperationsService,
    PrivacyService,
  ],
})
export class PrivacyModule {}
