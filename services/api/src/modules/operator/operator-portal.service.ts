import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from './admin-authorization.service';
import type {
  ListPartnerPortalPageQueryDto,
  OperatorPortalAccessDto,
  PartnerCompetitionDto,
  PartnerCompetitionPageDto,
  PartnerDashboardSnapshotDto,
  PartnerVisitPageDto,
  PartnerVisitStatus,
  PartnerVisitSummaryDto,
} from './dto/operator-portal.dto';
import {
  decodePartnerCompetitionCursor,
  decodePartnerVisitCursor,
  encodePartnerCompetitionCursor,
  encodePartnerVisitCursor,
} from './operator-pagination';

type PartnerAccess = Awaited<
  ReturnType<AdminAuthorizationService['requirePartnerPortal']>
>;

@Injectable()
export class OperatorPortalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: AdminAuthorizationService,
  ) {}

  getAccess(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorPortalAccessDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const access = await this.authorization.resolvePortalAccess(
          principal,
          transaction,
        );
        return {
          assignments: access.assignments,
          email: access.user.email ?? principal.email ?? '',
          portal: access.kind === 'platform_admin' ? 'gogymgo' : 'partner',
        };
      });
  }

  getPartnerDashboard(
    principal: AuthenticatedPrincipal,
  ): Promise<PartnerDashboardSnapshotDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const access = await this.authorization.requirePartnerPortal(
          principal,
          transaction,
        );
        const gymIds = access.assignments.map(
          (assignment) => assignment.gymLocationId,
        );
        const assignmentByGym = new Map(
          access.assignments.map((assignment) => [
            assignment.gymLocationId,
            assignment.accessLevel,
          ]),
        );
        const [
          gyms,
          regions,
          proposalCounts,
          activeVisits,
          competitions,
          visits,
        ] = await Promise.all([
          transaction
            .selectFrom('gym_locations as gym')
            .innerJoin(
              'region_policies as region',
              'region.id',
              'gym.region_policy_id',
            )
            .select([
              'gym.address',
              'gym.id',
              'gym.name',
              'gym.radius_meters',
              'gym.region_policy_id',
              'region.code as region_code',
              sql<
                Array<{
                  competitionId: string;
                  credentialVersion: number;
                  expiresAt: string;
                }>
              >`COALESCE((
                  SELECT json_agg(
                    json_build_object(
                      'competitionId', credential.competition_id,
                      'credentialVersion', credential.credential_version,
                      'expiresAt', credential.expires_at
                    )
                    ORDER BY credential.credential_version DESC
                  )
                  FROM gym_qr_credentials AS credential
                  WHERE credential.gym_location_id = gym.id
                    AND credential.status = 'active'
                    AND credential.competition_id IS NOT NULL
                    AND credential.expires_at > CURRENT_TIMESTAMP
                ), '[]'::json)`.as('active_qr_credentials'),
            ])
            .where('gym.id', 'in', gymIds)
            .where('gym.active', '=', true)
            .where('gym.deleted_at', 'is', null)
            .orderBy('gym.name')
            .orderBy('gym.id')
            .execute(),
          transaction
            .selectFrom('region_policies as region')
            .select([
              'region.code',
              'region.competition_enabled',
              'region.id',
              'region.metro_name',
              'region.timezone',
            ])
            .where(
              'region.id',
              'in',
              transaction
                .selectFrom('gym_locations')
                .select('region_policy_id')
                .where('id', 'in', gymIds),
            )
            .where('region.deleted_at', 'is', null)
            .orderBy('region.code')
            .execute(),
          transaction
            .selectFrom('partner_competition_proposals as proposal')
            .select([
              'proposal.status',
              sql<number>`count(*)::integer`.as('count'),
            ])
            .where('proposal.gym_location_id', 'in', gymIds)
            .where('proposal.status', 'in', ['draft', 'submitted'])
            .groupBy('proposal.status')
            .execute(),
          transaction
            .selectFrom('workout_sessions as session')
            .select(sql<number>`count(*)::integer`.as('count'))
            .where('session.gym_location_id', 'in', gymIds)
            .where('session.verification_mode', '=', 'static_qr')
            .where('session.status', '=', 'active')
            .where((expression) =>
              expression.or([
                expression('session.expires_at', 'is', null),
                expression('session.expires_at', '>', new Date()),
              ]),
            )
            .executeTakeFirstOrThrow(),
          this.listCompetitionsInTransaction(transaction, access, {
            limit: 25,
          }),
          this.listVisitsInTransaction(transaction, access, { limit: 25 }),
        ]);

        const proposalCountByStatus = new Map(
          proposalCounts.map((row) => [row.status, row.count]),
        );
        return {
          competitions,
          generatedAt: new Date().toISOString(),
          gyms: gyms.map((gym) => ({
            accessLevel: assignmentByGym.get(gym.id) ?? 'staff',
            activeQrCredentials: gym.active_qr_credentials,
            address: gym.address,
            id: gym.id,
            name: gym.name,
            radiusMeters: gym.radius_meters,
            regionCode: gym.region_code,
            regionPolicyId: gym.region_policy_id,
          })),
          operator: { email: access.user.email ?? principal.email ?? '' },
          overview: {
            activeVisitCount: activeVisits.count,
            assignedGymCount: gyms.length,
            draftProposalCount: proposalCountByStatus.get('draft') ?? 0,
            submittedProposalCount: proposalCountByStatus.get('submitted') ?? 0,
          },
          regions: regions.map((region) => ({
            code: region.code,
            competitionEnabled: region.competition_enabled,
            id: region.id,
            name: region.metro_name,
            timezone: region.timezone,
          })),
          visits,
        };
      });
  }

  listPartnerCompetitions(
    principal: AuthenticatedPrincipal,
    query: ListPartnerPortalPageQueryDto,
  ): Promise<PartnerCompetitionPageDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const access = await this.authorization.requirePartnerPortal(
          principal,
          transaction,
        );
        return this.listCompetitionsInTransaction(transaction, access, query);
      });
  }

  listPartnerVisits(
    principal: AuthenticatedPrincipal,
    query: ListPartnerPortalPageQueryDto,
  ): Promise<PartnerVisitPageDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const access = await this.authorization.requirePartnerPortal(
          principal,
          transaction,
        );
        return this.listVisitsInTransaction(transaction, access, query);
      });
  }

  private async listCompetitionsInTransaction(
    transaction: Transaction<Database>,
    access: PartnerAccess,
    query: ListPartnerPortalPageQueryDto,
  ): Promise<PartnerCompetitionPageDto> {
    const gymIds = access.assignments.map(
      (assignment) => assignment.gymLocationId,
    );
    const cursor = decodePartnerCompetitionCursor(query.cursor);
    let builder = transaction
      .selectFrom('competition_gym_locations as assignment')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'assignment.competition_id',
      )
      .innerJoin('gym_locations as gym', 'gym.id', 'assignment.gym_location_id')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'competition.region_policy_id',
      )
      .leftJoin('partner_competition_proposals as proposal', (join) =>
        join
          .onRef('proposal.competition_id', '=', 'competition.id')
          .onRef('proposal.gym_location_id', '=', 'gym.id'),
      )
      .select([
        'assignment.gym_location_id',
        'competition.configuration_version',
        'competition.ends_at',
        'competition.entrant_cap',
        'competition.id',
        'competition.month_key',
        'competition.name',
        'competition.region_policy_id',
        'competition.registration_closes_at',
        'competition.registration_opens_at',
        'competition.starts_at',
        'competition.status as competition_status',
        'gym.name as gym_name',
        'proposal.lifecycle_version as proposal_version',
        'proposal.status as proposal_status',
        'region.code as region_code',
        'region.metro_name as region_name',
      ])
      .where('assignment.gym_location_id', 'in', gymIds)
      .where('gym.active', '=', true)
      .where('gym.deleted_at', 'is', null)
      .where('region.deleted_at', 'is', null)
      .where((expression) =>
        expression.or([
          expression('competition.deleted_at', 'is', null),
          expression('proposal.status', '=', 'archived'),
        ]),
      );
    if (cursor) {
      builder = builder.where((expression) =>
        expression.or([
          expression('competition.starts_at', '<', cursor.startsAt),
          expression.and([
            expression('competition.starts_at', '=', cursor.startsAt),
            expression('competition.id', '<', cursor.id),
          ]),
          expression.and([
            expression('competition.starts_at', '=', cursor.startsAt),
            expression('competition.id', '=', cursor.id),
            expression('assignment.gym_location_id', '<', cursor.gymLocationId),
          ]),
        ]),
      );
    }
    const rows = await builder
      .orderBy('competition.starts_at', 'desc')
      .orderBy('competition.id', 'desc')
      .orderBy('assignment.gym_location_id', 'desc')
      .limit(query.limit + 1)
      .execute();
    const pageRows = rows.slice(0, query.limit);
    const competitionIds = [...new Set(pageRows.map((row) => row.id))];
    const [goalBrackets, enrollmentCounts] =
      competitionIds.length === 0
        ? [[], []]
        : await Promise.all([
            transaction
              .selectFrom('competition_goal_brackets')
              .select(['competition_id', 'goal_days', 'label'])
              .where('competition_id', 'in', competitionIds)
              .orderBy('goal_days')
              .execute(),
            transaction
              .selectFrom('competition_enrollments')
              .select([
                'competition_id',
                sql<number>`count(*)::integer`.as('count'),
              ])
              .where('competition_id', 'in', competitionIds)
              .where('status', '=', 'active')
              .groupBy('competition_id')
              .execute(),
          ]);
    const goalsByCompetition = new Map<
      string,
      { goalDays: number; label: string }[]
    >();
    for (const goal of goalBrackets) {
      const goals = goalsByCompetition.get(goal.competition_id) ?? [];
      goals.push({ goalDays: goal.goal_days, label: goal.label });
      goalsByCompetition.set(goal.competition_id, goals);
    }
    const enrollmentsByCompetition = new Map(
      enrollmentCounts.map((row) => [row.competition_id, row.count]),
    );
    const items: PartnerCompetitionDto[] = pageRows.map((row) => ({
      competitionStatus: row.competition_status,
      configurationVersion: row.configuration_version,
      endsAt: row.ends_at.toISOString(),
      enrollmentCount: enrollmentsByCompetition.get(row.id) ?? 0,
      entrantCap: row.entrant_cap,
      goalBrackets: goalsByCompetition.get(row.id) ?? [],
      gymLocationId: row.gym_location_id,
      gymName: row.gym_name,
      id: row.id,
      monthKey: row.month_key,
      name: row.name,
      proposalStatus: row.proposal_status,
      proposalVersion: row.proposal_version,
      regionCode: row.region_code,
      regionName: row.region_name,
      regionPolicyId: row.region_policy_id,
      registrationClosesAt: row.registration_closes_at.toISOString(),
      registrationOpensAt: row.registration_opens_at.toISOString(),
      startsAt: row.starts_at.toISOString(),
    }));
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodePartnerCompetitionCursor({
              gymLocationId: last.gym_location_id,
              id: last.id,
              startsAt: last.starts_at,
            })
          : null,
    };
  }

  private async listVisitsInTransaction(
    transaction: Transaction<Database>,
    access: PartnerAccess,
    query: ListPartnerPortalPageQueryDto,
  ): Promise<PartnerVisitPageDto> {
    const gymIds = access.assignments.map(
      (assignment) => assignment.gymLocationId,
    );
    const statusExpression = sql<PartnerVisitStatus>`CASE
      WHEN session.status = 'verified' THEN 'completed'
      WHEN session.status = 'pending_review' THEN 'pending_review'
      WHEN session.status = 'active'
        AND (session.expires_at IS NULL OR session.expires_at > CURRENT_TIMESTAMP)
        THEN 'in_progress'
      ELSE 'incomplete'
    END`;
    const visitRows = await transaction
      .selectFrom('workout_sessions as session')
      .innerJoin('gym_locations as gym', 'gym.id', 'session.gym_location_id')
      .select([
        'gym.id as gym_location_id',
        'gym.name as gym_name',
        statusExpression.as('visit_status'),
        sql<number>`count(*)::integer`.as('count'),
      ])
      .where('session.verification_mode', '=', 'static_qr')
      .where('gym.id', 'in', gymIds)
      .where('gym.active', '=', true)
      .where('gym.deleted_at', 'is', null)
      .groupBy(['gym.id', 'gym.name', statusExpression])
      .execute();
    const cursor = decodePartnerVisitCursor(query.cursor);
    const ordered: PartnerVisitSummaryDto[] = visitRows
      .map((row) => ({
        count: row.count,
        gymLocationId: row.gym_location_id,
        gymName: row.gym_name,
        status: row.visit_status,
      }))
      .sort(comparePartnerVisits)
      .filter((row) => !cursor || comparePartnerVisits(row, cursor) > 0);
    const items = ordered.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        ordered.length > query.limit && last
          ? encodePartnerVisitCursor(last)
          : null,
    };
  }
}

function comparePartnerVisits(
  left: Pick<PartnerVisitSummaryDto, 'gymLocationId' | 'gymName' | 'status'>,
  right: Pick<PartnerVisitSummaryDto, 'gymLocationId' | 'gymName' | 'status'>,
): number {
  return (
    left.gymName.localeCompare(right.gymName) ||
    left.gymLocationId.localeCompare(right.gymLocationId) ||
    left.status.localeCompare(right.status)
  );
}
