import { ForbiddenException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { ProfilesService } from '../profiles/profiles.service';
import { AdminAuthorizationService } from './admin-authorization.service';

const principal: AuthenticatedPrincipal = {
  emailVerified: true,
  firebaseUid: 'firebase-user',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describe('AdminAuthorizationService', () => {
  function transactionWithAssignments(
    assignments: { access_level: 'admin' | 'staff'; gym_location_id: string }[],
  ): Transaction<Database> {
    const query = {
      execute: jest.fn().mockResolvedValue(assignments),
      executeTakeFirst: jest.fn().mockResolvedValue(assignments[0]),
      innerJoin: jest.fn(),
      limit: jest.fn(),
      orderBy: jest.fn(),
      select: jest.fn(),
      where: jest.fn(),
    };
    query.innerJoin.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    return {
      selectFrom: jest.fn().mockReturnValue(query),
    } as unknown as Transaction<Database>;
  }

  it.each([null, 'google.com', 'apple.com', 'custom'])(
    'rejects the %s provider before consulting the profile database',
    async (signInProvider) => {
      const ensureUser = jest.fn();
      const profiles = {
        ensureUser,
        requireVerifiedEmail: jest.fn(),
      } as unknown as ProfilesService;
      const service = new AdminAuthorizationService(profiles);
      const attempt = service.requireAdmin(
        { ...principal, signInProvider },
        transactionWithAssignments([]),
      );

      await expect(attempt).rejects.toMatchObject({
        response: {
          code: 'OPERATOR_PASSWORD_SIGN_IN_REQUIRED',
        },
      });
      expect(ensureUser).not.toHaveBeenCalled();
    },
  );

  it('uses the authoritative database role rather than token claims', async () => {
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        roles: ['user'],
      }),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.requireAdmin(principal, transactionWithAssignments([])),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an active database user with the exact admin role', async () => {
    const admin = { id: 'admin-1', roles: ['admin', 'user'] };
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue(admin),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.requireAdmin(principal, transactionWithAssignments([])),
    ).resolves.toBe(admin);
  });

  it('fails closed when a platform administrator also has a partner role', async () => {
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({
        id: 'admin-1',
        roles: ['admin', 'gym_partner_staff', 'user'],
      }),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.resolvePortalAccess(principal, transactionWithAssignments([])),
    ).rejects.toMatchObject({
      response: { code: 'OPERATOR_ROLE_CONFLICT' },
    });
  });

  it('fails closed when a platform administrator retains an active gym assignment', async () => {
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({
        id: 'admin-1',
        roles: ['admin', 'user'],
      }),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.requireAdmin(
        principal,
        transactionWithAssignments([
          { access_level: 'staff', gym_location_id: 'gym-1' },
        ]),
      ),
    ).rejects.toMatchObject({
      response: { code: 'OPERATOR_ROLE_CONFLICT' },
    });
  });

  it('fails closed when a specialist global operator also has a partner role', async () => {
    const profiles = {
      ensureUser: jest.fn(),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.assertGlobalOperatorIsUnscoped(
        {
          id: 'operator-1',
          roles: ['operator', 'gym_partner_staff'],
        } as Awaited<ReturnType<ProfilesService['ensureUser']>>,
        transactionWithAssignments([]),
      ),
    ).rejects.toMatchObject({
      response: { code: 'OPERATOR_ROLE_CONFLICT' },
    });
  });

  it('fails closed when a specialist global operator retains an active gym assignment', async () => {
    const profiles = {
      ensureUser: jest.fn(),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.assertGlobalOperatorIsUnscoped(
        { id: 'operator-1', roles: ['operator'] } as Awaited<
          ReturnType<ProfilesService['ensureUser']>
        >,
        transactionWithAssignments([
          { access_level: 'staff', gym_location_id: 'gym-1' },
        ]),
      ),
    ).rejects.toMatchObject({
      response: { code: 'OPERATOR_ROLE_CONFLICT' },
    });
  });

  it('resolves a gym partner only from matching database roles and assignments', async () => {
    const partner = {
      email: 'partner@example.com',
      id: 'partner-1',
      roles: ['gym_partner_admin', 'gym_partner_staff'],
    };
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue(partner),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.resolvePortalAccess(
        principal,
        transactionWithAssignments([
          { access_level: 'admin', gym_location_id: 'gym-1' },
          { access_level: 'staff', gym_location_id: 'gym-2' },
        ]),
      ),
    ).resolves.toEqual({
      assignments: [
        { accessLevel: 'admin', gymLocationId: 'gym-1' },
        { accessLevel: 'staff', gymLocationId: 'gym-2' },
      ],
      kind: 'gym_partner',
      user: partner,
    });
  });

  it('denies a partner role that has no matching active gym assignment', async () => {
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({
        id: 'partner-1',
        roles: ['gym_partner_staff'],
      }),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.resolvePortalAccess(principal, transactionWithAssignments([])),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_ACCESS_STATE_CONFLICT' },
    });
  });

  it('enforces per-gym management level for partner actions', async () => {
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({
        id: 'partner-1',
        roles: ['gym_partner_staff'],
      }),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.requireGymAccess(
        principal,
        transactionWithAssignments([
          { access_level: 'staff', gym_location_id: 'gym-1' },
        ]),
        'gym-1',
        'admin',
      ),
    ).rejects.toMatchObject({
      response: { code: 'GYM_SCOPE_FORBIDDEN' },
    });
  });
});
