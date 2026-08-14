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
          draw_entrant_count: number | null;
          draw_entrant_snapshot_hash: string | null;
          draw_id: string | null;
          draw_locked_at: Date | null;
          draw_public_result_snapshot_hash: string | null;
          draw_reward_slot_count: number | null;
          draw_reward_snapshot_hash: string | null;
          draw_scoring_snapshot_hash: string | null;
          draw_seed_commitment: string | null;
          draw_settled_at: Date | null;
          draw_status: 'cancelled' | 'locked' | 'settled' | null;
          draw_total_entries: string | null;
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
      draw_entrant_count: null,
      draw_entrant_snapshot_hash: null,
      draw_id: null,
      draw_locked_at: null,
      draw_public_result_snapshot_hash: null,
      draw_reward_slot_count: null,
      draw_reward_snapshot_hash: null,
      draw_scoring_snapshot_hash: null,
      draw_seed_commitment: null,
      draw_settled_at: null,
      draw_status: null,
      draw_total_entries: null,
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
