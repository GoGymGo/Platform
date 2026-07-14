import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../../database/database.service';
import type { JsonObject } from '../../../database/database.types';
import type {
  HyperwalletClient,
  HyperwalletNotification,
} from '../hyperwallet/hyperwallet.types';
import { HYPERWALLET_CLIENT } from '../hyperwallet/hyperwallet.types';
import { PayoutsService } from '../payouts.service';
import {
  isActivatedTransferMethod,
  payoutStatusFromPaymentStatus,
} from '../provider-status';
import type { HyperwalletWebhookDto } from './hyperwallet-webhook.dto';

@Injectable()
export class HyperwalletWebhooksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly payouts: PayoutsService,
    @Inject(HYPERWALLET_CLIENT)
    private readonly hyperwallet: HyperwalletClient,
  ) {}

  async receive(webhook: HyperwalletWebhookDto): Promise<void> {
    const providerCreatedOn = webhook.createdOn
      ? new Date(webhook.createdOn)
      : null;
    const normalized: JsonObject = {
      announcedType: webhook.type,
    };
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          createdOn: webhook.createdOn ?? null,
          token: webhook.token,
          type: webhook.type,
        }),
      )
      .digest('hex');

    await this.database.connection
      .insertInto('provider_webhooks')
      .values({
        attempt_count: 0,
        event_type: webhook.type,
        normalized_payload: normalized,
        object_status: null,
        object_token: null,
        payload_hash: payloadHash,
        processed_at: null,
        processing_error: null,
        provider: 'hyperwallet',
        provider_created_on: providerCreatedOn,
        provider_webhook_token: webhook.token,
        received_at: new Date(),
        state: 'received',
      })
      .onConflict((conflict) =>
        conflict.column('provider_webhook_token').doNothing(),
      )
      .execute();
  }

  async processPending(limit = 25): Promise<number> {
    const pending = await this.database.connection
      .selectFrom('provider_webhooks')
      .select('provider_webhook_token')
      .where('state', 'in', ['received', 'failed'])
      .where('attempt_count', '<', 10)
      .orderBy('received_at')
      .limit(limit)
      .execute();
    let processed = 0;
    for (const webhook of pending) {
      try {
        await this.process(webhook.provider_webhook_token);
        processed += 1;
      } catch {
        // The durable inbox retains a safe error and can be retried by the worker.
      }
    }
    return processed;
  }

  async process(token: string): Promise<void> {
    const stored = await this.database.connection
      .selectFrom('provider_webhooks')
      .select(['provider_webhook_token', 'state'])
      .where('provider_webhook_token', '=', token)
      .executeTakeFirst();
    if (!stored) {
      throw new NotFoundException({
        code: 'PROVIDER_WEBHOOK_NOT_FOUND',
        message: 'The stored provider webhook was not found.',
      });
    }
    if (stored.state === 'processed') {
      return;
    }

    await this.database.connection
      .updateTable('provider_webhooks')
      .set({
        attempt_count: (expression) => expression('attempt_count', '+', 1),
      })
      .where('provider_webhook_token', '=', token)
      .execute();

    try {
      const notification =
        await this.hyperwallet.retrieveWebhookNotification(token);
      if (notification.token !== token) {
        throw new BadGatewayException({
          code: 'PROVIDER_WEBHOOK_TOKEN_MISMATCH',
          message: 'The provider webhook could not be reconciled.',
        });
      }
      await this.applyNotification(notification);
    } catch (error) {
      await this.database.connection
        .updateTable('provider_webhooks')
        .set({
          processing_error: this.safeErrorCode(error),
          state: 'failed',
        })
        .where('provider_webhook_token', '=', token)
        .execute();
      throw error;
    }
  }

  private async applyNotification(
    notification: HyperwalletNotification,
  ): Promise<void> {
    await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const normalized: JsonObject = {
          clientPaymentId: notification.clientPaymentId,
          destinationToken: notification.destinationToken,
          objectStatus: notification.objectStatus,
          objectToken: notification.objectToken,
          type: notification.type,
          userToken: notification.userToken,
        };

        if (notification.type.startsWith('PAYMENTS.')) {
          if (!notification.objectToken && !notification.clientPaymentId) {
            throw new NotFoundException({
              code: 'PAYOUT_PAYMENT_REFERENCE_MISSING',
              message: 'The payout payment could not be reconciled.',
            });
          }
          const payment = await transaction
            .selectFrom('payout_payments')
            .selectAll()
            .where((expression) =>
              expression.or([
                ...(notification.objectToken
                  ? [
                      expression(
                        'provider_payment_token',
                        '=',
                        notification.objectToken,
                      ),
                    ]
                  : []),
                ...(notification.clientPaymentId
                  ? [
                      expression(
                        'client_payment_id',
                        '=',
                        notification.clientPaymentId,
                      ),
                    ]
                  : []),
              ]),
            )
            .executeTakeFirst();
          if (!payment || !notification.objectStatus) {
            throw new NotFoundException({
              code: 'PAYOUT_PAYMENT_NOT_FOUND',
              message: 'The payout payment could not be reconciled.',
            });
          }
          await transaction
            .updateTable('payout_payments')
            .set({
              provider_payment_token:
                notification.objectToken ?? payment.provider_payment_token,
              provider_status: notification.objectStatus,
              updated_at: new Date(),
            })
            .where('id', '=', payment.id)
            .executeTakeFirstOrThrow();
          const nextStatus = payoutStatusFromPaymentStatus(
            notification.objectStatus,
          );
          await this.payouts.transitionClaim(
            transaction,
            payment.payout_claim_id,
            {
              eventId: notification.token,
              failureCode:
                nextStatus === 'failed' ? notification.objectStatus : null,
              metadata: {
                eventType: notification.type,
                providerStatus: notification.objectStatus,
              },
              nextStatus,
              source: 'hyperwallet_webhook',
            },
          );
        } else {
          await this.applyPayeeNotification(transaction, notification);
        }

        await transaction
          .updateTable('provider_webhooks')
          .set({
            event_type: notification.type,
            normalized_payload: normalized,
            object_status: notification.objectStatus,
            object_token: notification.objectToken,
            processed_at: new Date(),
            processing_error: null,
            provider_created_on: notification.createdOn,
            state: 'processed',
          })
          .where('provider_webhook_token', '=', notification.token)
          .executeTakeFirstOrThrow();
      });
  }

  private async applyPayeeNotification(
    transaction: Parameters<PayoutsService['transitionClaim']>[0],
    notification: HyperwalletNotification,
  ): Promise<void> {
    const userToken =
      notification.userToken ??
      notification.destinationToken ??
      (notification.type.startsWith('USERS.')
        ? notification.objectToken
        : null);
    if (!userToken) {
      return;
    }

    const providerUser = await transaction
      .selectFrom('hyperwallet_users')
      .select(['id', 'user_id'])
      .where('provider_user_token', '=', userToken)
      .executeTakeFirst();
    if (!providerUser) {
      throw new NotFoundException({
        code: 'PAYOUT_USER_NOT_FOUND',
        message: 'The payout user could not be reconciled.',
      });
    }
    if (notification.objectStatus && notification.type.startsWith('USERS.')) {
      await transaction
        .updateTable('hyperwallet_users')
        .set({
          provider_status: notification.objectStatus,
          updated_at: new Date(),
        })
        .where('id', '=', providerUser.id)
        .executeTakeFirstOrThrow();
    }
    if (
      isActivatedTransferMethod(notification.type, notification.objectStatus)
    ) {
      const claim = await transaction
        .selectFrom('payout_claims')
        .select(['id', 'status'])
        .where('user_id', '=', providerUser.user_id)
        .where('status', 'in', ['action_required', 'verification_pending'])
        .orderBy('created_at', 'desc')
        .forUpdate()
        .executeTakeFirst();
      if (claim) {
        await this.payouts.transitionClaim(transaction, claim.id, {
          eventId: notification.token,
          metadata: {
            eventType: notification.type,
            providerStatus: notification.objectStatus,
          },
          nextStatus: 'ready',
          source: 'hyperwallet_webhook',
        });
      }
    }
  }

  private safeErrorCode(error: unknown): string {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      typeof error.name === 'string'
    ) {
      return error.name.slice(0, 120);
    }
    return 'WebhookProcessingError';
  }
}
