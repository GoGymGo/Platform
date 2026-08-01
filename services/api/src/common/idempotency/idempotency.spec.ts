import { BadRequestException } from '@nestjs/common';
import { requireIdempotencyKey } from './idempotency-key';
import { stableJson } from './stable-json';

describe('idempotency primitives', () => {
  it('accepts stable URL-safe keys and rejects weak keys', () => {
    expect(requireIdempotencyKey('region-check:1234')).toBe(
      'region-check:1234',
    );
    expect(() => requireIdempotencyKey('short')).toThrow(BadRequestException);
    expect(() => requireIdempotencyKey(undefined)).toThrow(BadRequestException);
  });

  it('hashes semantically identical objects in a stable order', () => {
    expect(stableJson({ beta: 2, alpha: { two: true, one: false } })).toBe(
      stableJson({ alpha: { one: false, two: true }, beta: 2 }),
    );
  });
});
