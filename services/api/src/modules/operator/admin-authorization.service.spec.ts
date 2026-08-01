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
  tokenIssuedAt: 1,
};

describe('AdminAuthorizationService', () => {
  const transaction = {} as Transaction<Database>;

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
