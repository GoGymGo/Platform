import type { DatabaseService } from '../../database/database.service';
import type { AdminAuthorizationService } from './admin-authorization.service';
import { AdminDashboardService } from './admin-dashboard.service';
import type { AdminDashboardCompetitionDto } from './dto/admin-dashboard.dto';

describe('AdminDashboardService contest gym assignments', () => {
  it('returns the same gym independently for two distinct contests', () => {
    const service = new AdminDashboardService(
      {} as DatabaseService,
      {} as AdminAuthorizationService,
    );
    const presenter = service as unknown as {
      toCompetition(
        competition: {
          configuration_version: number;
          ends_at: Date;
          entrant_cap: number | null;
          id: string;
          minimum_entrants: number;
          month_key: string;
          name: string;
          region_code: string;
          region_name: string;
          region_policy_id: string;
          registration_closes_at: Date;
          registration_opens_at: Date;
          rules: unknown;
          rules_version: string;
          starts_at: Date;
          status: string;
        },
        goals: Map<string, { goalDays: number; label: string }[]>,
        enrollments: Map<string, number>,
        rewards: Map<string, { published: number; total: number }>,
        gyms: Map<string, string[]>,
      ): AdminDashboardCompetitionDto;
    };
    const competition = (id: string) => ({
      configuration_version: 1,
      ends_at: new Date('2026-10-01T07:00:00.000Z'),
      entrant_cap: null,
      id,
      minimum_entrants: 2,
      month_key: '2026-09',
      name: `Contest ${id}`,
      region_code: 'region-one',
      region_name: 'Vancouver Island + Gulf Islands',
      region_policy_id: 'region-1',
      registration_closes_at: new Date('2026-09-01T07:00:00.000Z'),
      registration_opens_at: new Date('2026-08-01T07:00:00.000Z'),
      rules: {},
      rules_version: '2026-09-v1',
      starts_at: new Date('2026-09-01T07:00:00.000Z'),
      status: 'draft',
    });
    const gymAssignments = new Map([
      ['contest-one', ['gym-skygate']],
      ['contest-two', ['gym-skygate']],
    ]);
    const present = (id: string) =>
      presenter.toCompetition(
        competition(id),
        new Map(),
        new Map(),
        new Map(),
        gymAssignments,
      );

    expect(present('contest-one').assignedGymIds).toEqual(['gym-skygate']);
    expect(present('contest-two').assignedGymIds).toEqual(['gym-skygate']);
  });
});
