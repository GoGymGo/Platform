import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { AdminLegalDocumentsService } from './admin-legal-documents.service';
import {
  LegalDocumentsController,
  LegalReceiptsController,
  OperatorLegalDocumentsController,
} from './legal.controller';
import { LegalDocumentsService } from './legal-documents.service';

@Module({
  controllers: [
    LegalDocumentsController,
    LegalReceiptsController,
    OperatorLegalDocumentsController,
  ],
  exports: [LegalDocumentsService],
  imports: [AdminAuthorizationModule, IdempotencyModule, ProfilesModule],
  providers: [AdminLegalDocumentsService, LegalDocumentsService],
})
export class LegalModule {}
