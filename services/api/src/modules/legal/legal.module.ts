import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { AdminLegalDocumentsService } from './admin-legal-documents.service';
import {
  LegalDocumentsController,
  LegalReceiptsController,
  OperatorLegalDocumentsController,
  VerificationConsentsController,
} from './legal.controller';
import { LegalDocumentsService } from './legal-documents.service';
import { VerificationConsentsService } from './verification-consents.service';

@Module({
  controllers: [
    LegalDocumentsController,
    LegalReceiptsController,
    OperatorLegalDocumentsController,
    VerificationConsentsController,
  ],
  exports: [
    AdminLegalDocumentsService,
    LegalDocumentsService,
    VerificationConsentsService,
  ],
  imports: [AdminAuthorizationModule, IdempotencyModule, ProfilesModule],
  providers: [
    AdminLegalDocumentsService,
    LegalDocumentsService,
    VerificationConsentsService,
  ],
})
export class LegalModule {}
