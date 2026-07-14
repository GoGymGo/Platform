import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('returns a stable validation envelope', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          header: () => undefined,
          id: 'request-123',
          originalUrl: '/v1/example',
        }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(
      new BadRequestException({
        message: ['email must be an email', 'name is required'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: ['email must be an email', 'name is required'],
        message: 'email must be an email',
        path: '/v1/example',
        requestId: 'request-123',
      }),
    });
  });

  it('does not leak internal exception messages', () => {
    const json = jest.fn();
    const error = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          header: () => undefined,
          id: 'request-500',
          log: { error },
          originalUrl: '/v1/example',
        }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new Error('database password leaked'), host);

    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: 'An unexpected error occurred.',
      }),
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'Error',
        event: 'api.request.failed',
        requestId: 'request-500',
        statusCode: 500,
      }),
      'Unhandled API exception',
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(
      'database password leaked',
    );
  });
});
