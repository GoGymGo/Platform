import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { DrawsService } from '../draws/draws.service';
import type { ProfilesService } from '../profiles/profiles.service';
import type { ProfileMediaModerationService } from '../profiles/profile-media-moderation.service';
import type { SessionsService } from '../sessions/sessions.service';
import type { AdminAuthorizationService } from './admin-authorization.service';
import { OperatorService } from './operator.service';

function queryBuilder(result?: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'forUpdate',
    'returning',
    'select',
    'set',
    'values',
    'where',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query.executeTakeFirst = jest.fn().mockResolvedValue(result);
  query.executeTakeFirstOrThrow = jest.fn().mockResolvedValue(result ?? {});
  return query;
}

describe('OperatorService privacy decisions', () => {
  const principal: AuthenticatedPrincipal = {
    emailVerified: true,
    firebaseUid: 'operator-firebase',
    roles: ['admin'],
    signInProvider: 'password',
    tokenIssuedAt: 1,
  };

  function setup(
    currentVersion = 4,
    subjectUserId = 'subject-user',
    status = 'requested',
  ) {
    const selection = queryBuilder({
      id: '10000000-0000-4000-8000-000000000001',
      status,
      user_id: subjectUserId,
      version: currentVersion,
    });
    const update = queryBuilder({
      id: '10000000-0000-4000-8000-000000000001',
    });
    const privacyEvent = queryBuilder();
    const operatorAudit = queryBuilder();
    const transaction = {
      insertInto: jest.fn((table: string) =>
        table === 'privacy_request_events' ? privacyEvent : operatorAudit,
      ),
      selectFrom: jest.fn(() => selection),
      updateTable: jest.fn(() => update),
    } as unknown as Transaction<Database>;
    const execute = jest.fn(
      async (
        _options: unknown,
        handler: (
          value: Transaction<Database>,
          operatorId: string,
        ) => Promise<JsonObject>,
        authorize?: (value: Transaction<Database>) => Promise<string>,
      ) => {
        const operatorId = authorize
          ? await authorize(transaction)
          : 'missing-operator';
        return handler(transaction, operatorId);
      },
    );
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({
        id: 'operator-user',
        roles: ['admin'],
      }),
      requireVerifiedEmail: jest.fn(),
    } as unknown as ProfilesService;
    const adminAuthorization = {
      assertGlobalOperatorIsUnscoped: jest.fn(),
    } as unknown as AdminAuthorizationService;
    const service = new OperatorService(
      {} as DatabaseService,
      { execute } as unknown as IdempotencyService,
      {} as ConfigService<Environment, true>,
      {} as DrawsService,
      profiles,
      {} as ProfileMediaModerationService,
      {} as SessionsService,
      adminAuthorization,
    );
    return {
      execute,
      operatorAudit,
      privacyEvent,
      service,
      update,
    };
  }

  it('binds the target, expected version, decision, and reason to idempotency', async () => {
    const { execute, operatorAudit, privacyEvent, service, update } = setup();

    await expect(
      service.decidePrivacyRequest(
        principal,
        '10000000-0000-4000-8000-000000000001',
        'decision-key',
        {
          decision: 'processing',
          expectedVersion: 4,
          reason: 'Identity and scope verified.',
        },
      ),
    ).resolves.toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      status: 'processing',
    });
    expect(execute).toHaveBeenCalledWith(
      {
        actorKey: 'firebase:operator-firebase',
        key: 'decision-key',
        request: {
          decision: 'processing',
          expectedVersion: 4,
          privacyRequestId: '10000000-0000-4000-8000-000000000001',
          reason: 'Identity and scope verified.',
        },
        scope: 'operator:privacy-request:decision',
      },
      expect.any(Function),
      expect.any(Function),
    );
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', version: 5 }),
    );
    expect(update.where).toHaveBeenCalledWith('version', '=', 4);
    expect(privacyEvent.values).toHaveBeenCalledWith(
      expect.objectContaining({
        next_status: 'processing',
        previous_status: 'requested',
        source_event_id: 'decision-key',
      }),
    );
    expect(operatorAudit.values).toHaveBeenCalledWith(
      expect.objectContaining({
        next_state: { status: 'processing', version: 5 },
        previous_state: { status: 'requested', version: 4 },
        reason: 'Identity and scope verified.',
      }),
    );
  });

  it('rejects a stale expected version before writing a transition', async () => {
    const { privacyEvent, service, update } = setup(5);

    await expect(
      service.decidePrivacyRequest(
        principal,
        '10000000-0000-4000-8000-000000000001',
        'decision-key',
        {
          decision: 'rejected',
          expectedVersion: 4,
          reason: 'Request could not be verified.',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update.set).not.toHaveBeenCalled();
    expect(privacyEvent.values).not.toHaveBeenCalled();
  });

  it('rejects self-review before writing a transition', async () => {
    const { privacyEvent, service, update } = setup(4, 'operator-user');

    await expect(
      service.decidePrivacyRequest(
        principal,
        '10000000-0000-4000-8000-000000000001',
        'decision-key',
        {
          decision: 'rejected',
          expectedVersion: 4,
          reason: 'Request could not be verified.',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update.set).not.toHaveBeenCalled();
    expect(privacyEvent.values).not.toHaveBeenCalled();
  });

  it('rejects an already-started request before writing another transition', async () => {
    const { privacyEvent, service, update } = setup(
      4,
      'subject-user',
      'processing',
    );

    await expect(
      service.decidePrivacyRequest(
        principal,
        '10000000-0000-4000-8000-000000000001',
        'decision-key',
        {
          decision: 'rejected',
          expectedVersion: 4,
          reason: 'Request is no longer awaiting a decision.',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update.set).not.toHaveBeenCalled();
    expect(privacyEvent.values).not.toHaveBeenCalled();
  });
});
