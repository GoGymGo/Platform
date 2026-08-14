import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';

export type PortalAccess =
  | {
      kind: 'platform_admin';
      assignments: [];
      user: Awaited<ReturnType<ProfilesService['ensureUser']>>;
    }
  | {
      kind: 'gym_partner';
      assignments: {
        accessLevel: 'admin' | 'staff';
        gymLocationId: string;
      }[];
      user: Awaited<ReturnType<ProfilesService['ensureUser']>>;
    };

export function assertOperatorPasswordPrincipal(
  principal: AuthenticatedPrincipal,
): void {
  if (principal.signInProvider !== 'password') {
    throw new ForbiddenException({
      code: 'OPERATOR_PASSWORD_SIGN_IN_REQUIRED',
      message:
        'Use the email and password credentials issued directly by GoGymGo.',
    });
  }
}

@Injectable()
export class AdminAuthorizationService {
  constructor(private readonly profiles: ProfilesService) {}

  async requireAdmin(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ) {
    const user = await this.requirePasswordUser(principal, transaction);
    if (!user.roles.includes('admin')) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'An administrator role is required for configuration changes.',
      });
    }
    await this.assertGlobalOperatorIsUnscoped(user, transaction);
    return user;
  }

  async resolvePortalAccess(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ): Promise<PortalAccess> {
    const user = await this.requirePasswordUser(principal, transaction);
    if (user.roles.includes('admin')) {
      await this.assertGlobalOperatorIsUnscoped(user, transaction);
      return { assignments: [], kind: 'platform_admin', user };
    }

    const partnerAdmin = user.roles.includes('gym_partner_admin');
    const partnerStaff = user.roles.includes('gym_partner_staff');
    if (!partnerAdmin && !partnerStaff) {
      throw new ForbiddenException({
        code: 'OPERATOR_PORTAL_ACCESS_REQUIRED',
        message: 'A GoGymGo or gym-partner role is required for this portal.',
      });
    }

    const assignments = await transaction
      .selectFrom('gym_partner_assignments as assignment')
      .innerJoin('gym_locations as gym', 'gym.id', 'assignment.gym_location_id')
      .select(['assignment.access_level', 'assignment.gym_location_id'])
      .where('assignment.user_id', '=', user.id)
      .where('assignment.active', '=', true)
      .where('gym.active', '=', true)
      .where('gym.deleted_at', 'is', null)
      .orderBy('assignment.gym_location_id')
      .execute();
    const authorizedAssignments = assignments
      .filter(
        (assignment) =>
          (assignment.access_level === 'admin' && partnerAdmin) ||
          (assignment.access_level === 'staff' &&
            (partnerAdmin || partnerStaff)),
      )
      .map((assignment) => ({
        accessLevel: assignment.access_level,
        gymLocationId: assignment.gym_location_id,
      }));
    if (authorizedAssignments.length === 0) {
      throw new ForbiddenException({
        code: 'PARTNER_GYM_ASSIGNMENT_REQUIRED',
        message: 'This partner account is not assigned to an active gym.',
      });
    }
    return { assignments: authorizedAssignments, kind: 'gym_partner', user };
  }

  async requirePartnerPortal(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ): Promise<Extract<PortalAccess, { kind: 'gym_partner' }>> {
    const access = await this.resolvePortalAccess(principal, transaction);
    if (access.kind !== 'gym_partner') {
      throw new ForbiddenException({
        code: 'GYM_PARTNER_ACCESS_REQUIRED',
        message: 'A gym-partner account is required for this workspace.',
      });
    }
    return access;
  }

  async requireGymAccess(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
    gymLocationId: string,
    minimumAccess: 'admin' | 'staff' = 'staff',
  ): Promise<PortalAccess> {
    const access = await this.resolvePortalAccess(principal, transaction);
    if (access.kind === 'platform_admin') return access;
    const assignment = access.assignments.find(
      (candidate) => candidate.gymLocationId === gymLocationId,
    );
    if (
      !assignment ||
      (minimumAccess === 'admin' && assignment.accessLevel !== 'admin')
    ) {
      throw new ForbiddenException({
        code: 'GYM_SCOPE_FORBIDDEN',
        message: 'This account cannot manage the requested gym.',
      });
    }
    return access;
  }

  async audit(
    transaction: Transaction<Database>,
    input: {
      action: string;
      actorUserId: string;
      entityId: string;
      entityType: string;
      nextState: JsonObject;
      previousState: JsonObject | null;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('operator_audit_events')
      .values({
        action: input.action,
        actor_user_id: input.actorUserId,
        created_at: new Date(),
        entity_id: input.entityId,
        entity_type: input.entityType,
        next_state: input.nextState,
        previous_state: input.previousState,
        reason: input.reason.trim(),
        request_id: input.requestId,
      })
      .executeTakeFirstOrThrow();
  }

  async assertGlobalOperatorIsUnscoped(
    user: Awaited<ReturnType<ProfilesService['ensureUser']>>,
    transaction: Transaction<Database>,
  ): Promise<void> {
    const hasPartnerRole = user.roles.some((role) =>
      ['gym_partner_admin', 'gym_partner_staff'].includes(role),
    );
    if (hasPartnerRole) {
      throw new ForbiddenException({
        code: 'OPERATOR_ROLE_CONFLICT',
        message:
          'Platform operations and gym-partner access cannot be combined.',
      });
    }
    const assignment = await transaction
      .selectFrom('gym_partner_assignments')
      .select('gym_location_id')
      .where('user_id', '=', user.id)
      .where('active', '=', true)
      .limit(1)
      .executeTakeFirst();
    if (assignment) {
      throw new ForbiddenException({
        code: 'OPERATOR_ROLE_CONFLICT',
        message:
          'Platform operations and gym-partner access cannot be combined.',
      });
    }
  }

  private async requirePasswordUser(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ) {
    assertOperatorPasswordPrincipal(principal);
    const user = await this.profiles.ensureUser(principal, transaction);
    this.profiles.requireVerifiedEmail(user);
    return user;
  }
}
