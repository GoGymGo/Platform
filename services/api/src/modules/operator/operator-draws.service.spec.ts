import type { ConfigService } from '@nestjs/config';
import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { DrawsService } from '../draws/draws.service';
import type { ProfileMediaModerationService } from '../profiles/profile-media-moderation.service';
import type { ProfilesService } from '../profiles/profiles.service';
import type { SessionsService } from '../sessions/sessions.service';
import type { AdminAuthorizationService } from './admin-authorization.service';
import { OperatorService } from './operator.service';

const principal: AuthenticatedPrincipal = {
  email: 'admin@gogymgo.test',
  emailVerified: true,
  firebaseUid: 'firebase-admin-1',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

function createService() {
  const transaction = {} as Transaction<Database>;
  const adminAuthorization = {
    requireAdmin: jest.fn().mockResolvedValue({ id: 'operator-user-1' }),
  };
  const idempotency = {
    execute: jest.fn(
      async (
        _options: unknown,
        handler: (
          value: Transaction<Database>,
          operatorId: string,
        ) => Promise<unknown>,
        authorize: (value: Transaction<Database>) => Promise<string>,
      ) => handler(transaction, await authorize(transaction)),
    ),
  };
  const draws = {
    lock: jest.fn().mockResolvedValue({
      drawId: '40000000-0000-4000-8000-000000000002',
      entrantCount: 2,
      entrantSnapshotHash: 'a'.repeat(64),
      lockedAt: '2026-09-01T07:15:00.000Z',
      publicResultSnapshotHash: 'b'.repeat(64),
      rewardSlotCount: 1,
      rewardSnapshotHash: 'c'.repeat(64),
      scoringSnapshotHash: 'd'.repeat(64),
      status: 'locked',
      totalEntries: '42',
    }),
    settle: jest.fn().mockResolvedValue({
      drawId: '40000000-0000-4000-8000-000000000002',
      winnerCount: 1,
    }),
  };
  return {
    adminAuthorization,
    draws,
    idempotency,
    service: new OperatorService(
      {} as DatabaseService,
      idempotency as unknown as IdempotencyService,
      {} as ConfigService<Environment, true>,
      draws as unknown as DrawsService,
      {} as ProfilesService,
      {} as ProfileMediaModerationService,
      {} as SessionsService,
      adminAuthorization as unknown as AdminAuthorizationService,
    ),
    transaction,
  };
}

describe('OperatorService audited draw commands', () => {
  it('authorizes an exact admin inside the idempotent lock transaction', async () => {
    const { adminAuthorization, draws, idempotency, service, transaction } =
      createService();
    const input = {
      competitionId: '40000000-0000-4000-8000-000000000001',
      reason: 'Lock the audited contest snapshot.',
      seedCommitment: 'e'.repeat(64),
    };

    await expect(
      service.lockDraw(principal, 'lock-key-1', input),
    ).resolves.toEqual(
      expect.objectContaining({
        entrantSnapshotHash: 'a'.repeat(64),
        id: '40000000-0000-4000-8000-000000000002',
        status: 'locked',
      }),
    );

    expect(idempotency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKey: 'firebase:firebase-admin-1',
        key: 'lock-key-1',
        request: input,
        scope: 'operator:draws:lock',
      }),
      expect.any(Function),
      expect.any(Function),
    );
    expect(adminAuthorization.requireAdmin).toHaveBeenCalledWith(
      principal,
      transaction,
    );
    expect(draws.lock).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        operatorUserId: 'operator-user-1',
        requestId: 'lock-key-1',
      }),
    );
  });

  it('keeps the reveal inside the authorized idempotent settlement transaction', async () => {
    const { draws, idempotency, service, transaction } = createService();
    const drawId = '40000000-0000-4000-8000-000000000002';
    const input = {
      reason: 'Reveal and publish the audited contest result.',
      seedReveal: 'f'.repeat(64),
    };

    await expect(
      service.settleDraw(principal, drawId, 'settle-key-1', input),
    ).resolves.toEqual({ id: drawId, status: 'settled' });
    expect(idempotency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKey: 'firebase:firebase-admin-1',
        key: 'settle-key-1',
        request: { drawId, ...input },
        scope: 'operator:draws:settle',
      }),
      expect.any(Function),
      expect.any(Function),
    );
    expect(draws.settle).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        operatorUserId: 'operator-user-1',
        requestId: 'settle-key-1',
        seedReveal: input.seedReveal,
      }),
    );
  });
});
