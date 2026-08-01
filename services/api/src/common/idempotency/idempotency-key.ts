import { BadRequestException } from '@nestjs/common';

const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || !idempotencyKeyPattern.test(value)) {
    throw new BadRequestException({
      code: 'INVALID_IDEMPOTENCY_KEY',
      message:
        'Idempotency-Key is required and must be 8-128 URL-safe characters beginning with a letter or number.',
    });
  }

  return value;
}
