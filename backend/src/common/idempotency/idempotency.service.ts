import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Transaction } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import { stableJson } from './stable-json';

interface IdempotencyOptions {
  actorKey: string;
  key: string;
  request: JsonObject;
  responseCode?: number;
  scope: string;
  storeResponseBody?: boolean;
}

const redactedResponseBody: JsonObject = { redacted: true };

@Injectable()
export class IdempotencyService {
  constructor(private readonly database: DatabaseService) {}

  async execute<T extends JsonObject>(
    options: IdempotencyOptions,
    handler: (transaction: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    const requestHash = createHash('sha256')
      .update(stableJson(options.request))
      .digest('hex');
    const now = new Date();

    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await transaction
          .deleteFrom('idempotency_keys')
          .where('scope', '=', options.scope)
          .where('actor_key', '=', options.actorKey)
          .where('idempotency_key', '=', options.key)
          .where('expires_at', '<', now)
          .execute();

        const reservation = await transaction
          .insertInto('idempotency_keys')
          .values({
            actor_key: options.actorKey,
            created_at: now,
            expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
            idempotency_key: options.key,
            request_hash: requestHash,
            scope: options.scope,
            state: 'processing',
          })
          .onConflict((conflict) =>
            conflict
              .columns(['scope', 'actor_key', 'idempotency_key'])
              .doNothing(),
          )
          .returning('id')
          .executeTakeFirst();

        if (!reservation) {
          const existing = await transaction
            .selectFrom('idempotency_keys')
            .selectAll()
            .where('scope', '=', options.scope)
            .where('actor_key', '=', options.actorKey)
            .where('idempotency_key', '=', options.key)
            .executeTakeFirstOrThrow();

          if (existing.request_hash !== requestHash) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message:
                'This idempotency key was already used for a different request.',
            });
          }

          if (existing.state === 'completed') {
            if (options.storeResponseBody === false) {
              return handler(transaction);
            }
            if (
              existing.response_body &&
              typeof existing.response_body === 'object' &&
              !Array.isArray(existing.response_body)
            ) {
              return { ...existing.response_body } as T;
            }
          }

          throw new ConflictException({
            code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
            message:
              'A request with this idempotency key is already in progress.',
          });
        }

        const result = await handler(transaction);
        await transaction
          .updateTable('idempotency_keys')
          .set({
            completed_at: new Date(),
            response_body:
              options.storeResponseBody === false
                ? redactedResponseBody
                : result,
            response_code: options.responseCode ?? 200,
            state: 'completed',
          })
          .where('id', '=', reservation.id)
          .executeTakeFirstOrThrow();

        return result;
      });
  }
}
