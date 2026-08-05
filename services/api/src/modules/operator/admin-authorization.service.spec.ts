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

  it('rejects social-provider sessions for the operator console', async () => {
    const ensureUser = jest.fn();
    const profiles = {
      ensureUser,
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const service = new AdminAuthorizationService(profiles);

    await expect(
      service.requireAdmin(
        { ...principal, signInProvider: 'google.com' },
        transaction,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'OPERATOR_PASSWORD_SIGN_IN_REQUIRED',
      },
    });
    expect(ensureUser).not.toHaveBeenCalled();
  });

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
});
