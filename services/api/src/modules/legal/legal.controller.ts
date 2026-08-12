import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import { AdminDeletedEntityResponseDto } from '../operator/dto/admin-configuration.dto';
import { AdminLegalDocumentsService } from './admin-legal-documents.service';
import {
  AdminLegalDocumentResponseDto,
  CurrentLegalDocumentsResponseDto,
  LegalDocumentQueryDto,
  LegalReceiptStatusResponseDto,
  PublishLegalDocumentDto,
  RecordLegalReceiptBundleDto,
  SetVerificationConsentDto,
  VerificationConsentStatusResponseDto,
  WithdrawLegalDocumentDto,
} from './dto/legal.dto';
import { LegalDocumentsService } from './legal-documents.service';
import { VerificationConsentsService } from './verification-consents.service';

@ApiTags('legal-documents')
@Controller('legal-documents')
export class LegalDocumentsController {
  constructor(private readonly legalDocuments: LegalDocumentsService) {}

  @Get('current')
  @Public()
  @ApiOperation({
    summary:
      'Return the current server-authoritative legal document bundle for a jurisdiction and locale',
  })
  @ApiOkResponse({ type: CurrentLegalDocumentsResponseDto })
  getCurrent(
    @Query() query: LegalDocumentQueryDto,
  ): Promise<CurrentLegalDocumentsResponseDto> {
    return this.legalDocuments.getCurrent(query);
  }
}

@ApiTags('legal-receipts')
@ApiBearerAuth('firebase')
@Controller('me/legal-receipts')
export class LegalReceiptsController {
  constructor(private readonly legalDocuments: LegalDocumentsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Return this account current legal receipt status' })
  @ApiOkResponse({ type: LegalReceiptStatusResponseDto })
  getStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: LegalDocumentQueryDto,
  ): Promise<LegalReceiptStatusResponseDto> {
    return this.legalDocuments.getStatus(principal, query);
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Atomically record receipts for the exact current legal bundle',
  })
  @ApiCreatedResponse({ type: LegalReceiptStatusResponseDto })
  record(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RecordLegalReceiptBundleDto,
  ): Promise<LegalReceiptStatusResponseDto> {
    return this.legalDocuments.recordReceiptBundle(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}

@ApiTags('verification-consents')
@ApiBearerAuth('firebase')
@Controller('me/verification-consents')
export class VerificationConsentsController {
  constructor(
    private readonly verificationConsents: VerificationConsentsService,
  ) {}

  @Get('device-presence')
  @ApiOperation({
    summary: 'Return the current device-presence and QR-camera consent status',
  })
  @ApiOkResponse({ type: VerificationConsentStatusResponseDto })
  getStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VerificationConsentStatusResponseDto> {
    return this.verificationConsents.getStatus(principal);
  }

  @Put('device-presence')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Grant or withdraw device-presence and QR-camera consent',
  })
  @ApiOkResponse({ type: VerificationConsentStatusResponseDto })
  setStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: SetVerificationConsentDto,
  ): Promise<VerificationConsentStatusResponseDto> {
    return this.verificationConsents.setStatus(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}

@ApiTags('operator-configuration')
@ApiBearerAuth('firebase')
@Controller('operator/configuration/legal-documents')
export class OperatorLegalDocumentsController {
  constructor(private readonly legalDocuments: AdminLegalDocumentsService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Publish an immutable legal document version' })
  @ApiCreatedResponse({ type: AdminLegalDocumentResponseDto })
  publish(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: PublishLegalDocumentDto,
  ): Promise<AdminLegalDocumentResponseDto> {
    return this.legalDocuments.publish(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post(':legalDocumentId/withdrawal')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Withdraw an immutable legal document version' })
  @ApiOkResponse({ type: AdminLegalDocumentResponseDto })
  withdraw(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('legalDocumentId', ParseUUIDPipe) legalDocumentId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: WithdrawLegalDocumentDto,
  ): Promise<AdminLegalDocumentResponseDto> {
    return this.legalDocuments.withdraw(
      principal,
      legalDocumentId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Delete(':legalDocumentId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Delete a withdrawn legal version from the admin dashboard',
  })
  @ApiOkResponse({ type: AdminDeletedEntityResponseDto })
  delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('legalDocumentId', ParseUUIDPipe) legalDocumentId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: WithdrawLegalDocumentDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.legalDocuments.delete(
      principal,
      legalDocumentId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}
