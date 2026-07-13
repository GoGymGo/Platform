import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type RequestWithId = Request & { id?: string };

interface ExceptionBody {
  code?: unknown;
  message?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.getExceptionBody(exception);
    const messages = Array.isArray(body.message)
      ? body.message.filter(
          (value): value is string => typeof value === 'string',
        )
      : undefined;
    const safeMessage =
      status >= 500
        ? 'An unexpected error occurred.'
        : (messages?.[0] ??
          (typeof body.message === 'string'
            ? body.message
            : 'The request could not be completed.'));
    const code =
      typeof body.code === 'string'
        ? body.code
        : status === 400
          ? 'VALIDATION_ERROR'
          : `HTTP_${status}`;

    response.status(status).json({
      error: {
        code,
        message: safeMessage,
        ...(messages && messages.length > 1 ? { details: messages } : {}),
        path: request.originalUrl,
        requestId: request.id ?? request.header('x-request-id') ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  }

  private getExceptionBody(exception: unknown): ExceptionBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    return typeof response === 'string' ? { message: response } : response;
  }
}
