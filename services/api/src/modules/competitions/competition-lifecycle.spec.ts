import { resolveCompetitionStart } from './competition-lifecycle';

describe('competition lifecycle', () => {
  it('activates a competition that reaches its minimum entrant threshold', () => {
    expect(resolveCompetitionStart(1, 1)).toBe('active');
    expect(resolveCompetitionStart(1, 2)).toBe('active');
  });

  it('cancels a competition that misses its minimum entrant threshold', () => {
    expect(resolveCompetitionStart(1, 0)).toBe('cancelled');
  });
});
