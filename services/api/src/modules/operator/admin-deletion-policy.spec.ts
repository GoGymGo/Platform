import {
  canDeleteCompetition,
  canDeleteCreatorWorkout,
  canDeleteGym,
  canDeleteLegalDocument,
  canDeleteRegionPolicy,
  canDeleteReward,
  requiresExclusiveCompetitionSlot,
} from './admin-deletion-policy';

describe('admin deletion policy', () => {
  it('allows only terminal or disposable contest and reward records', () => {
    expect(canDeleteCompetition('draft')).toBe(true);
    expect(canDeleteCompetition('cancelled')).toBe(true);
    expect(canDeleteCompetition('settled')).toBe(true);
    expect(canDeleteCompetition('active')).toBe(false);
    expect(canDeleteReward('draft')).toBe(true);
    expect(canDeleteReward('archived')).toBe(true);
    expect(canDeleteReward('published')).toBe(false);
  });

  it('requires workouts and gyms to be inactive first', () => {
    expect(canDeleteCreatorWorkout(false)).toBe(true);
    expect(canDeleteCreatorWorkout(true)).toBe(false);
    expect(canDeleteGym(false)).toBe(true);
    expect(canDeleteGym(true)).toBe(false);
  });

  it('allows retired regions and withdrawn legal versions', () => {
    const now = new Date('2026-08-08T12:00:00.000Z');
    expect(
      canDeleteRegionPolicy({
        competitionEnabled: false,
        now,
        validTo: null,
      }),
    ).toBe(true);
    expect(
      canDeleteRegionPolicy({
        competitionEnabled: true,
        now,
        validTo: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toBe(true);
    expect(
      canDeleteRegionPolicy({
        competitionEnabled: true,
        now,
        validTo: null,
      }),
    ).toBe(false);
    expect(canDeleteLegalDocument('withdrawn')).toBe(true);
    expect(canDeleteLegalDocument('effective')).toBe(false);
  });

  it('does not reserve a region and month for platform contests', () => {
    expect(requiresExclusiveCompetitionSlot(null)).toBe(false);
    expect(requiresExclusiveCompetitionSlot('partner-gym-id')).toBe(true);
  });
});
