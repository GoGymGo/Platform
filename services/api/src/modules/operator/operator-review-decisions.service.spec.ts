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

const principal: AuthenticatedPrincipal = {
  emailVerified: true,
  firebaseUid: 'operator-firebase',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};
const reason = 'Reviewed against the current authoritative submission.';

function queryBuilder(result?: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'forUpdate',
    'innerJoin',
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

function setup(current: Record<string, unknown>) {
  const selection = queryBuilder(current);
  const update = queryBuilder({ id: current.id });
  const audit = queryBuilder();
  const transaction = {
    insertInto: jest.fn(() => audit),
    selectFrom: jest.fn(() => selection),
    updateTable: jest.fn(() => update),
  } as unknown as Transaction<Database>;
  const ensureUser = jest.fn().mockResolvedValue({
    id: 'operator-user',
    roles: ['admin'],
  });
  const execute = jest.fn(
    async (
      _options: unknown,
      handler: (
        value: Transaction<Database>,
        operatorId: string,
      ) => Promise<JsonObject>,
      reauthorize?: (value: Transaction<Database>) => Promise<string>,
    ) =>
      handler(
        transaction,
        reauthorize ? await reauthorize(transaction) : 'missing-operator',
      ),
  );
  const profiles = {
    ensureUser,
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
  return { audit, ensureUser, execute, service, update };
}

type SubmissionKind = 'creator_submission' | 'partner_application';

function decideSubmission(
  service: OperatorService,
  kind: SubmissionKind,
  decision: 'approved' | 'in_review' | 'rejected',
  expectedVersion = 3,
) {
  return kind === 'creator_submission'
    ? service.decideCreatorSubmission(
        principal,
        'submission-id',
        'request-id',
        {
          decision,
          expectedVersion,
          reason,
        },
      )
    : service.decidePartnerApplication(
        principal,
        'submission-id',
        'request-id',
        {
          decision,
          expectedVersion,
          reason,
        },
      );
}

describe.each([
  ['partner_application', 'operator:partner-application:decision'],
  ['creator_submission', 'operator:creator-submission:decision'],
] as const)('%s review decisions', (kind, scope) => {
  it('binds the complete body, reauthorizes, versions, and audits once', async () => {
    const harness = setup({
      id: 'submission-id',
      review_version: 3,
      status: 'submitted',
      user_id: 'member-user',
    });

    await expect(
      decideSubmission(harness.service, kind, 'in_review'),
    ).resolves.toEqual({ id: 'submission-id', status: 'in_review' });
    expect(harness.execute).toHaveBeenCalledWith(
      {
        actorKey: 'firebase:operator-firebase',
        key: 'request-id',
        request: expect.objectContaining({
          decision: 'in_review',
          expectedVersion: 3,
          reason,
          [kind === 'creator_submission' ? 'submissionId' : 'applicationId']:
            'submission-id',
        }),
        scope,
      },
      expect.any(Function),
      expect.any(Function),
    );
    expect(harness.ensureUser).toHaveBeenCalledTimes(1);
    expect(harness.update.where).toHaveBeenCalledWith('review_version', '=', 3);
    expect(harness.audit.values).toHaveBeenCalledWith(
      expect.objectContaining({
        next_state: { status: 'in_review', version: 4 },
        previous_state: { status: 'submitted', version: 3 },
      }),
    );
  });

  it.each([
    [
      'stale version',
      { review_version: 4, status: 'submitted', user_id: 'member-user' },
    ],
    [
      'self review',
      { review_version: 3, status: 'submitted', user_id: 'operator-user' },
    ],
    [
      'invalid transition',
      { review_version: 3, status: 'in_review', user_id: 'member-user' },
    ],
  ])('rejects %s before updating', async (_label, current) => {
    const harness = setup({ id: 'submission-id', ...current });
    const action = decideSubmission(
      harness.service,
      kind,
      current.status === 'in_review' ? 'in_review' : 'approved',
      3,
    );
    if (current.user_id === 'operator-user') {
      await expect(action).rejects.toBeInstanceOf(ForbiddenException);
    } else {
      await expect(action).rejects.toBeInstanceOf(ConflictException);
    }
    expect(harness.update.set).not.toHaveBeenCalled();
    expect(harness.audit.values).not.toHaveBeenCalled();
  });
});

describe('region verification decisions', () => {
  function region(overrides: Record<string, unknown> = {}) {
    return {
      competition_enabled: true,
      current_policy_version: 'policy-v1',
      id: 'verification-id',
      method: 'device_location',
      policy_deleted_at: null,
      policy_version: 'policy-v1',
      review_version: 2,
      status: 'pending',
      user_id: 'member-user',
      valid_from: new Date('2020-01-01T00:00:00.000Z'),
      valid_to: new Date('2099-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  function decide(service: OperatorService, expectedVersion = 2) {
    return service.decideRegionVerification(
      principal,
      'verification-id',
      'request-id',
      { decision: 'approved', expectedVersion, reason },
    );
  }

  it('binds expiry/version/body and reauthorizes inside idempotency', async () => {
    const harness = setup(region());
    await expect(decide(harness.service)).resolves.toEqual({
      id: 'verification-id',
      status: 'approved',
    });
    expect(harness.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          decision: 'approved',
          expectedVersion: 2,
          expiresAt: null,
          reason,
          verificationId: 'verification-id',
        },
      }),
      expect.any(Function),
      expect.any(Function),
    );
    expect(harness.ensureUser).toHaveBeenCalledTimes(1);
    expect(harness.update.where).toHaveBeenCalledWith('review_version', '=', 2);
  });

  it.each([
    ['stale version', { review_version: 3 }, 2, ConflictException],
    ['self review', { user_id: 'operator-user' }, 2, ForbiddenException],
    ['invalid state', { status: 'approved' }, 2, ConflictException],
    [
      'stale policy',
      { current_policy_version: 'policy-v2' },
      2,
      ConflictException,
    ],
  ])(
    'rejects %s before updating',
    async (_label, overrides, version, ErrorType) => {
      const harness = setup(region(overrides));
      await expect(decide(harness.service, version)).rejects.toBeInstanceOf(
        ErrorType,
      );
      expect(harness.update.set).not.toHaveBeenCalled();
      expect(harness.audit.values).not.toHaveBeenCalled();
    },
  );
});
