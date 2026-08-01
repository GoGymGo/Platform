import { normalizeDateKey } from './date-key';

describe('normalizeDateKey', () => {
  it('preserves PostgreSQL date strings', () => {
    expect(normalizeDateKey('2026-07-13')).toBe('2026-07-13');
  });

  it('normalizes date objects without leaking a timestamp', () => {
    expect(normalizeDateKey(new Date('2026-07-13T00:00:00.000Z'))).toBe(
      '2026-07-13',
    );
  });

  it('fails closed for unexpected database values', () => {
    expect(() => normalizeDateKey('2026-07-13T00:00:00.000Z')).toThrow(
      'Unexpected database date key.',
    );
  });
});
