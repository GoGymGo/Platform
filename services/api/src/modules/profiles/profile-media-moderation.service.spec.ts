import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { PrivateObjectStorage } from '../storage/private-object-storage';
import type { ProfilesService } from './profiles.service';
import { ProfileMediaModerationService } from './profile-media-moderation.service';

function queryBuilder(result?: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'forUpdate',
    'returning',
    'selectAll',
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

function setup(overrides: Record<string, unknown> = {}) {
  const media = {
    id: 'media-id',
    object_key: 'avatars/member/media.jpg',
    review_version: 3,
    status: 'pending_review',
    user_id: 'member-user',
    ...overrides,
  };
  const selection = queryBuilder(media);
  const update = queryBuilder({ id: 'media-id' });
  const audit = queryBuilder();
  const transaction = {
    insertInto: jest.fn(() => audit),
    selectFrom: jest.fn(() => selection),
    updateTable: jest.fn(() => update),
  } as unknown as Transaction<Database>;
  const execute = jest.fn(
    async (
      _options: unknown,
      handler: (
        value: Transaction<Database>,
        operatorId?: string,
      ) => Promise<JsonObject>,
      authorize?: (value: Transaction<Database>) => Promise<string>,
    ) =>
      handler(
        transaction,
        authorize ? await authorize(transaction) : undefined,
      ),
  );
  const config = {
    get: jest.fn((key: keyof Environment) => {
      if (key === 'PRIVATE_CONTENT_BUCKET') return 'private-bucket';
      if (key === 'PROFILE_MEDIA_ENABLED') return true;
      if (key === 'PROFILE_MEDIA_READ_TTL_SECONDS') return 300;
      return undefined;
    }),
  } as unknown as ConfigService<Environment, true>;
  const service = new ProfileMediaModerationService(
    config,
    {} as DatabaseService,
    { execute } as unknown as IdempotencyService,
    {} as ProfilesService,
    {} as PrivateObjectStorage,
  );
  return { audit, execute, service, update };
}

const reason = 'Reviewed the private preview against the media policy.';

function decide(
  service: ProfileMediaModerationService,
  authorize: (transaction: Transaction<Database>) => Promise<string>,
  expectedVersion = 3,
) {
  return service.decide({
    authorize,
    decision: 'rejected',
    expectedVersion,
    mediaId: 'media-id',
    operatorUserId: 'initial-operator',
    reason,
    requestId: 'request-id',
  });
}

describe('profile media decisions', () => {
  it('body-binds the version, reauthorizes in-transaction, and audits it', async () => {
    const harness = setup();
    const authorize = jest.fn().mockResolvedValue('current-operator');

    await expect(decide(harness.service, authorize)).resolves.toEqual({
      id: 'media-id',
      status: 'rejected',
    });
    expect(harness.execute).toHaveBeenCalledWith(
      {
        actorKey: 'operator:initial-operator',
        key: 'request-id',
        request: {
          decision: 'rejected',
          expectedVersion: 3,
          mediaId: 'media-id',
          reason,
        },
        scope: 'profile-media:decision',
      },
      expect.any(Function),
      authorize,
    );
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(harness.update.where).toHaveBeenCalledWith('review_version', '=', 3);
    expect(harness.audit.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'current-operator',
        next_state: { status: 'rejected', version: 4 },
        previous_state: { status: 'pending_review', version: 3 },
      }),
    );
  });

  it.each([
    [
      'stale version',
      { review_version: 4 },
      'current-operator',
      ConflictException,
    ],
    [
      'self review',
      { user_id: 'current-operator' },
      'current-operator',
      ForbiddenException,
    ],
    [
      'invalid state',
      { status: 'approved' },
      'current-operator',
      ConflictException,
    ],
  ])(
    'rejects %s before updating',
    async (_label, overrides, operatorId, ErrorType) => {
      const harness = setup(overrides);
      await expect(
        decide(harness.service, () => Promise.resolve(operatorId)),
      ).rejects.toBeInstanceOf(ErrorType);
      expect(harness.update.set).not.toHaveBeenCalled();
      expect(harness.audit.values).not.toHaveBeenCalled();
    },
  );
});
