import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AdminLegalDocumentsService } from './admin-legal-documents.service';
import {
  AdminLegalDocumentResponseDto,
  CurrentLegalDocumentsResponseDto,
  LegalDocumentQueryDto,
  LegalReceiptStatusResponseDto,
  PublishLegalDocumentDto,
  RecordLegalReceiptBundleDto,
  WithdrawLegalDocumentDto,
} from './dto/legal.dto';
import { LegalDocumentsService } from './legal-documents.service';

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
}
