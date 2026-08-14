import { BadRequestException } from '@nestjs/common';
import {
  aliasValidationError,
  normalizeAlias,
  requireValidPublicAlias,
} from './alias-policy';

describe('public Alias policy', () => {
  it('normalizes one case-insensitive ASCII Alias representation', () => {
    expect(normalizeAlias('  runner_42 ')).toBe('RUNNER_42');
    expect(requireValidPublicAlias(' runner_42 ')).toBe('RUNNER_42');
  });

  it.each([
    'AA',
    'A'.repeat(25),
    'RUNNER-DASH',
    'RÜNNER',
    'ADMIN',
    'SUPPORT_TEAM',
    'GG_012345ABCDEF',
  ])('rejects invalid, confusable, or reserved Alias %s', (alias) => {
    expect(aliasValidationError(alias)).not.toBeNull();
    expect(() => requireValidPublicAlias(alias)).toThrow(BadRequestException);
  });
});
