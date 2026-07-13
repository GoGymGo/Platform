import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  PushDeviceResponseDto,
  RegisterPushDeviceDto,
} from './dto/push-device.dto';
import type { ExpoPushClient } from './expo-push.client';
import { EXPO_PUSH_CLIENT } from './expo-push.client';
import { renderNotification } from './notification-template';

interface PushDeviceJson extends JsonObject {
  enabled: boolean;
  id: string;
  platform: 'android' | 'ios';
  provider: 'expo';
}

@Injectable()
export class NotificationsService {
  private readonly pushEnabled: boolean;

  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
    @Inject(EXPO_PUSH_CLIENT) private readonly pushClient: ExpoPushClient,
    config: ConfigService<Environment, true>,
  ) {
    this.pushEnabled = config.get('PUSH_NOTIFICATIONS_ENABLED', {
      infer: true,
    });
  }

  registerDevice(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: RegisterPushDeviceDto,
  ): Promise<PushDeviceResponseDto> {
    return this.idempotency.execute<PushDeviceJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          platform: input.platform,
          pushToken: input.pushToken,
        },
        responseCode: 201,
        scope: 'push-devices:register',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const device = await transaction
          .insertInto('push_devices')
          .values({
            created_at: now,
            enabled: true,
            platform: input.platform,
            provider: 'expo',
            push_token: input.pushToken,
            updated_at: now,
            user_id: user.id,
          })
          .onConflict((conflict) =>
            conflict.column('push_token').doUpdateSet({
              enabled: true,
              platform: input.platform,
              provider: 'expo',
              updated_at: now,
              user_id: user.id,
            }),
          )
          .returning(['enabled', 'id', 'platform', 'provider'])
          .executeTakeFirstOrThrow();
        return device;
      },
    );
  }

  async disableDevice(
    principal: AuthenticatedPrincipal,
    deviceId: string,
  ): Promise<void> {
    await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const result = await transaction
          .updateTable('push_devices')
          .set({ enabled: false, updated_at: new Date() })
          .where('id', '=', deviceId)
          .where('user_id', '=', user.id)
          .returning('id')
          .executeTakeFirst();
        if (!result) {
          throw new NotFoundException({
            code: 'PUSH_DEVICE_NOT_FOUND',
            message: 'The push device was not found.',
          });
        }
      });
  }

  async enqueue(
    transaction: Transaction<Database>,
    userId: string,
    template: string,
    payload: JsonObject,
  ): Promise<void> {
    renderNotification(template, payload);
    await transaction
      .insertInto('notification_deliveries')
      .values({
        attempt_count: 0,
        created_at: new Date(),
        last_error: null,
        payload,
        scheduled_at: new Date(),
        sent_at: null,
        status: 'pending',
        template,
        updated_at: new Date(),
        user_id: userId,
      })
      .executeTakeFirstOrThrow();
  }

  async processPending(limit = 50): Promise<number> {
    if (!this.pushEnabled) {
      return 0;
    }
    const deliveries = await this.database.connection
      .selectFrom('notification_deliveries')
      .selectAll()
      .where('status', 'in', ['pending', 'failed'])
      .where('attempt_count', '<', 5)
      .where('scheduled_at', '<=', new Date())
      .orderBy('scheduled_at')
      .limit(limit)
      .execute();
    let sent = 0;
    for (const delivery of deliveries) {
      const devices = await this.database.connection
        .selectFrom('push_devices')
        .select('push_token')
        .where('user_id', '=', delivery.user_id)
        .where('enabled', '=', true)
        .execute();
      if (devices.length === 0) {
        await this.updateDelivery(delivery.id, 'cancelled', null);
        continue;
      }

      try {
        const content = renderNotification(
          delivery.template,
          this.toJsonObject(delivery.payload),
        );
        await this.pushClient.send(
          devices.map((device) => ({ ...content, to: device.push_token })),
        );
        await this.updateDelivery(delivery.id, 'sent', null);
        sent += 1;
      } catch (error) {
        await this.updateDelivery(delivery.id, 'failed', this.safeError(error));
      }
    }
    return sent;
  }

  private async updateDelivery(
    id: string,
    status: 'cancelled' | 'failed' | 'sent',
    lastError: string | null,
  ): Promise<void> {
    await this.database.connection
      .updateTable('notification_deliveries')
      .set({
        attempt_count: (expression) => expression('attempt_count', '+', 1),
        last_error: lastError,
        sent_at: status === 'sent' ? new Date() : null,
        status,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }

  private toJsonObject(value: unknown): JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private safeError(error: unknown): string {
    return error instanceof Error ? error.name.slice(0, 120) : 'PushError';
  }
}
