import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
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
import {
  AppendSessionEventDto,
  CompleteSessionDto,
  CreateSessionDto,
  SessionCompletionResponseDto,
  SessionEventResponseDto,
  SessionResponseDto,
  StartedSessionResponseDto,
} from './dto/session.dto';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@ApiBearerAuth('firebase')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Start an authoritative competition workout session',
  })
  @ApiCreatedResponse({ type: StartedSessionResponseDto })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreateSessionDto,
  ): Promise<StartedSessionResponseDto> {
    return this.sessions.create(
      principal,
      requireIdempotencyKey(idempotencyKey),
      request,
    );
  }

  @Post(':sessionId/events')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Append immutable, untrusted evidence to an active session',
  })
  @ApiCreatedResponse({ type: SessionEventResponseDto })
  appendEvent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() event: AppendSessionEventDto,
  ): Promise<SessionEventResponseDto> {
    return this.sessions.appendEvent(
      principal,
      sessionId,
      requireIdempotencyKey(idempotencyKey),
      event,
    );
  }

  @Post(':sessionId/complete')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Close a session and submit it for server-side evidence review',
  })
  @ApiOkResponse({ type: SessionCompletionResponseDto })
  complete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CompleteSessionDto,
  ): Promise<SessionCompletionResponseDto> {
    return this.sessions.complete(
      principal,
      sessionId,
      requireIdempotencyKey(idempotencyKey),
      request,
    );
  }

  @Post(':sessionId/cancel')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary:
      'Cancel an active workout session without submitting it for review',
  })
  @ApiOkResponse({ type: SessionResponseDto })
  cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<SessionResponseDto> {
    return this.sessions.cancel(
      principal,
      sessionId,
      requireIdempotencyKey(idempotencyKey),
    );
  }
}
