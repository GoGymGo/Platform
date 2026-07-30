import { resolveCompetitionStart } from './competition-lifecycle';

describe('competition lifecycle', () => {
  it('activates a competition that reaches its minimum entrant threshold', () => {
    expect(resolveCompetitionStart(100, 100)).toBe('active');
    expect(resolveCompetitionStart(100, 125)).toBe('active');
  });

  it('cancels a competition that misses its minimum entrant threshold', () => {
    expect(resolveCompetitionStart(100, 99)).toBe('cancelled');
  });
});
