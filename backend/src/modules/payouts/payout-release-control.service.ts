import { ConflictException, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import type {
  PayoutReleaseControlActionDto,
  PayoutReleaseControlResponseDto,
} from './dto/payout.dto';

interface PayoutReleaseControlJson extends JsonObject {
  paused: boolean;
  reason: string;
  version: number;
}

const PAYOUT_RELEASE_CONTROL_AUDIT_ENTITY_ID =
  '00000000-0000-4000-8000-000000000001';

@Injectable()
export class PayoutReleaseControlService {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly authorization: AdminAuthorizationService,
  ) {}

  get(
    transaction: Transaction<Database>,
  ): Promise<PayoutReleaseControlResponseDto> {
    return transaction
      .selectFrom('payout_release_control')
      .select(['paused', 'reason', 'version'])
      .where('control_key', '=', 'global')
      .executeTakeFirstOrThrow();
  }

  async assertReleaseAllowed(
    transaction: Transaction<Database>,
  ): Promise<void> {
    const control = await transaction
      .selectFrom('payout_release_control')
      .select(['paused', 'reason'])
      .where('control_key', '=', 'global')
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (control.paused) {
      throw new ConflictException({
        code: 'PAYOUT_RELEASES_PAUSED',
        details: { reason: control.reason },
        message: 'Payout releases are paused by an administrator.',
      });
    }
  }

  change(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: PayoutReleaseControlActionDto,
  ): Promise<PayoutReleaseControlResponseDto> {
    return this.idempotency.execute<PayoutReleaseControlJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          action: input.action,
          expectedVersion: input.expectedVersion,
          reason: input.reason,
        },
        scope: 'operator:payout-release-control:status-action',
      },
      async (transaction) => {
        const administrator = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const current = await transaction
          .selectFrom('payout_release_control')
          .selectAll()
          .where('control_key', '=', 'global')
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (current.version !== input.expectedVersion) {
          throw new ConflictException({
            code: 'PAYOUT_RELEASE_CONTROL_VERSION_STALE',
            details: {
              currentVersion: current.version,
              expectedVersion: input.expectedVersion,
            },
            message:
              'The payout release control changed. Refresh it before deciding.',
          });
        }
        const paused = input.action === 'pause';
        if (current.paused === paused) {
          return {
            paused: current.paused,
            reason: current.reason,
            version: current.version,
          };
        }

        const updated = await transaction
          .updateTable('payout_release_control')
          .set({
            changed_by_user_id: administrator.id,
            paused,
            reason: input.reason.trim(),
            updated_at: new Date(),
            version: sql<number>`version + 1`,
          })
          .where('control_key', '=', 'global')
          .where('version', '=', current.version)
          .returning(['paused', 'reason', 'version'])
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: paused
            ? 'payout_release_control.paused'
            : 'payout_release_control.resumed',
          actorUserId: administrator.id,
          entityId: PAYOUT_RELEASE_CONTROL_AUDIT_ENTITY_ID,
          entityType: 'payout_release_control',
          nextState: { paused: updated.paused, version: updated.version },
          previousState: {
            paused: current.paused,
            version: current.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return updated;
      },
    );
  }
}
