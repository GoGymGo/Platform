import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from './admin-authorization.service';
import type {
  OperatorPortalAccessDto,
  PartnerDashboardSnapshotDto,
} from './dto/operator-portal.dto';

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
          id: access.user.id,
          portal: access.kind === 'platform_admin' ? 'gogymgo' : 'partner',
          roles: access.user.roles,
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
        const now = new Date();
        const [gyms, sessions, competitions] = await Promise.all([
          transaction
            .selectFrom('gym_locations as gym')
            .innerJoin(
              'region_policies as region',
              'region.id',
              'gym.region_policy_id',
            )
            .select([
              'gym.active',
              'gym.address',
              'gym.created_at',
              'gym.id',
              'gym.name',
              'gym.radius_meters',
              'gym.region_policy_id',
              'gym.updated_at',
              'region.code as region_code',
              sql<number | null>`(
                SELECT MAX(credential.credential_version)::integer
                FROM gym_qr_credentials AS credential
                WHERE credential.gym_location_id = gym.id
                  AND credential.status = 'active'
              )`.as('active_credential_version'),
              sql<
                Array<{ competitionId: string; credentialVersion: number }>
              >`COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'competitionId', credential.competition_id,
                    'credentialVersion', credential.credential_version
                  )
                  ORDER BY credential.credential_version DESC
                )
                FROM gym_qr_credentials AS credential
                WHERE credential.gym_location_id = gym.id
                  AND credential.status = 'active'
                  AND credential.competition_id IS NOT NULL
              ), '[]'::json)`.as('active_qr_credentials'),
              sql<number>`ST_Y(gym.coordinates::geometry)`.as('latitude'),
              sql<number>`ST_X(gym.coordinates::geometry)`.as('longitude'),
            ])
            .where('gym.id', 'in', gymIds)
            .where('gym.deleted_at', 'is', null)
            .orderBy('gym.name')
            .execute(),
          transaction
            .selectFrom('workout_sessions as session')
            .innerJoin(
              'gym_locations as gym',
              'gym.id',
              'session.gym_location_id',
            )
            .select([
              'gym.id as gym_id',
              'gym.name as gym_name',
              'session.completed_at',
              'session.expires_at',
              'session.id',
              'session.started_at',
              'session.status',
            ])
            .where('session.verification_mode', '=', 'static_qr')
            .where('gym.id', 'in', gymIds)
            .orderBy('session.started_at', 'desc')
            .limit(500)
            .execute(),
          transaction
            .selectFrom('competition_gym_locations as assignment')
            .innerJoin(
              'competitions as competition',
              'competition.id',
              'assignment.competition_id',
            )
            .innerJoin(
              'gym_locations as gym',
              'gym.id',
              'assignment.gym_location_id',
            )
            .leftJoin('partner_competition_proposals as proposal', (join) =>
              join
                .onRef('proposal.competition_id', '=', 'competition.id')
                .onRef('proposal.gym_location_id', '=', 'gym.id'),
            )
            .innerJoin(
              'region_policies as region',
              'region.id',
              'competition.region_policy_id',
            )
            .select([
              'competition.id',
              'competition.configuration_version',
              'competition.ends_at',
              'competition.entrant_cap',
              'competition.minimum_entrants',
              'competition.month_key',
              'competition.name',
              'competition.region_policy_id',
              'competition.registration_closes_at',
              'competition.registration_opens_at',
              'competition.rules',
              'competition.rules_version',
              'competition.starts_at',
              'competition.status',
              'gym.id as gym_id',
              'gym.name as gym_name',
              'proposal.proposed_by_user_id',
              'region.code as region_code',
              'region.metro_name as region_name',
            ])
            .where('assignment.gym_location_id', 'in', gymIds)
            .where('competition.deleted_at', 'is', null)
            .where('gym.deleted_at', 'is', null)
            .orderBy('competition.starts_at', 'desc')
            .execute(),
        ]);

        const competitionIds = competitions.map(
          (competition) => competition.id,
        );
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
        for (const bracket of goalBrackets) {
          const current = goalsByCompetition.get(bracket.competition_id) ?? [];
          current.push({
            goalDays: bracket.goal_days,
            label: bracket.label,
          });
          goalsByCompetition.set(bracket.competition_id, current);
        }
        const enrollmentByCompetition = new Map(
          enrollmentCounts.map((row) => [row.competition_id, row.count]),
        );
        const regionIds = [...new Set(gyms.map((gym) => gym.region_policy_id))];
        const regions =
          regionIds.length === 0
            ? []
            : await transaction
                .selectFrom('region_policies')
                .select([
                  'id',
                  'boundary_version',
                  'code',
                  'competition_enabled',
                  'country_code',
                  'currency',
                  'language_codes',
                  'metro_name',
                  'minimum_age',
                  'policy_version',
                  'subdivision_code',
                  'timezone',
                  'valid_from',
                  'valid_to',
                ])
                .where('id', 'in', regionIds)
                .where('deleted_at', 'is', null)
                .execute();

        return {
          competitions: competitions.map((competition) => ({
            assignedGymIds: [competition.gym_id],
            endsAt: competition.ends_at.toISOString(),
            enrollmentCount: enrollmentByCompetition.get(competition.id) ?? 0,
            entrantCap: competition.entrant_cap,
            goalBrackets: goalsByCompetition.get(competition.id) ?? [],
            gymLocationId: competition.gym_id,
            gymName: competition.gym_name,
            id: competition.id,
            minimumEntrants: competition.minimum_entrants,
            monthKey: competition.month_key,
            name: competition.name,
            proposedByUserId: competition.proposed_by_user_id,
            publishedRewardCount: 0,
            regionCode: competition.region_code,
            regionName: competition.region_name,
            regionPolicyId: competition.region_policy_id,
            registrationClosesAt:
              competition.registration_closes_at.toISOString(),
            registrationOpensAt:
              competition.registration_opens_at.toISOString(),
            rewardCount: 0,
            rules: competition.rules as Record<string, unknown>,
            rulesVersion: competition.rules_version,
            startsAt: competition.starts_at.toISOString(),
            status: competition.status,
            version: competition.configuration_version,
          })),
          generatedAt: now.toISOString(),
          gyms: gyms.map((gym) => ({
            accessLevel: assignmentByGym.get(gym.id) ?? 'staff',
            active: gym.active,
            activeCredentialVersion: gym.active_credential_version,
            activeQrCredentials: gym.active_qr_credentials,
            address: gym.address,
            createdAt: gym.created_at.toISOString(),
            id: gym.id,
            latitude: Number(gym.latitude),
            longitude: Number(gym.longitude),
            name: gym.name,
            radiusMeters: gym.radius_meters,
            regionCode: gym.region_code,
            regionPolicyId: gym.region_policy_id,
            updatedAt: gym.updated_at.toISOString(),
          })),
          operator: {
            email: access.user.email ?? principal.email ?? '',
            id: access.user.id,
            roles: access.user.roles,
          },
          regions: regions.map((region) => ({
            boundaryVersion: region.boundary_version,
            code: region.code,
            competitionEnabled: region.competition_enabled,
            countryCode: region.country_code,
            currency: region.currency,
            id: region.id,
            languageCodes: region.language_codes,
            metroName: region.metro_name,
            minimumAge: region.minimum_age,
            policyVersion: region.policy_version,
            subdivisionCode: region.subdivision_code,
            timezone: region.timezone,
            validFrom: region.valid_from.toISOString(),
            validTo: region.valid_to?.toISOString() ?? null,
          })),
          sessions: sessions.map((session) => ({
            completedAt: session.completed_at?.toISOString() ?? null,
            gymLocationId: session.gym_id,
            gymName: session.gym_name,
            id: session.id,
            incomplete:
              session.status === 'cancelled' ||
              (session.status === 'active' &&
                session.expires_at !== null &&
                session.expires_at <= now),
            startedAt: session.started_at.toISOString(),
            status: session.status,
          })),
        };
      });
  }
}
