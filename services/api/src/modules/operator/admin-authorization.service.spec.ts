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
  const transaction = {} as Transaction<Database>;

  function transactionWithAssignments(
    assignments: { access_level: 'admin' | 'staff'; gym_location_id: string }[],
  ): Transaction<Database> {
    const query = {
      execute: jest.fn().mockResolvedValue(assignments),
      orderBy: jest.fn(),
      select: jest.fn(),
      where: jest.fn(),
    };
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
        transaction,
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

    await expect(service.requireAdmin(principal, transaction)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an active database user with the exact admin role', async () => {
    const admin = { id: 'admin-1', roles: ['admin', 'user'] };
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue(admin),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(service.requireAdmin(principal, transaction)).resolves.toBe(
      admin,
    );
  });

  it('resolves a gym partner only from matching database roles and assignments', async () => {
    const partner = {
      email: 'partner@example.com',
      id: 'partner-1',
      roles: ['gym_partner_admin'],
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

  it('denies partner roles that have no active gym assignment', async () => {
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
      response: { code: 'PARTNER_GYM_ASSIGNMENT_REQUIRED' },
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
