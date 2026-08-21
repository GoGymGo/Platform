import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Selectable, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  PushCapabilitiesResponseDto,
  PushDeviceResponseDto,
  RegisterPushDeviceDto,
} from './dto/push-device.dto';
import type { ExpoPushClient, PushSendResult } from './expo-push.client';
import { EXPO_PUSH_CLIENT, PushProviderError } from './expo-push.client';
import {
  notificationDedupeKey,
  renderNotification,
} from './notification-template';

interface PushDeviceJson extends JsonObject {
  enabled: boolean;
  id: string;
  platform: 'android' | 'ios';
  provider: 'expo';
}

type RegistrationContext = { userId: string };
type ClaimedNotification = Selectable<Database['notification_deliveries']> & {
  lease_token: string;
  target_device_ids: string[];
};
type DeliveryDevice = { id: string; push_token: string };

const maximumDevicesPerUser = 5;
const maximumDeliveryAttempts = 5;
const notificationLeaseMilliseconds = 30_000;
const retryBackoffMilliseconds = [60_000, 300_000, 1_800_000, 7_200_000];

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

  getCapabilities(): PushCapabilitiesResponseDto {
    return {
      deliveryStatus: this.pushEnabled ? 'available' : 'disabled',
      maximumDevices: maximumDevicesPerUser,
      registrationAvailable: this.pushEnabled,
    };
  }

  registerDevice(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: RegisterPushDeviceDto,
  ): Promise<PushDeviceResponseDto> {
    if (!this.pushEnabled) {
      throw new ServiceUnavailableException({
        code: 'PUSH_REGISTRATION_DISABLED',
        message: 'Remote push registration is disabled in this environment.',
      });
    }

    return this.idempotency.execute<PushDeviceJson, RegistrationContext>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          installationId: input.installationId,
          platform: input.platform,
          pushToken: input.pushToken,
        },
        responseCode: 201,
        scope: 'push-devices:register',
      },
      async (transaction, context) => {
        const now = new Date();
        const conflictingToken = await transaction
          .selectFrom('push_devices')
          .select(['id', 'installation_id', 'user_id'])
          .where('push_token', '=', input.pushToken)
          .executeTakeFirst();
        if (
          conflictingToken &&
          (conflictingToken.user_id !== context.userId ||
            conflictingToken.installation_id !== input.installationId)
        ) {
          await this.disableDeviceRow(transaction, conflictingToken.id, now);
        }

        const device = await transaction
          .insertInto('push_devices')
          .values({
            created_at: now,
            disabled_at: null,
            enabled: true,
            installation_id: input.installationId,
            last_registered_at: now,
            platform: input.platform,
            provider: 'expo',
            push_token: input.pushToken,
            updated_at: now,
            user_id: context.userId,
          })
          .onConflict((conflict) =>
            conflict.columns(['user_id', 'installation_id']).doUpdateSet({
              disabled_at: null,
              enabled: true,
              last_registered_at: now,
              platform: input.platform,
              provider: 'expo',
              push_token: input.pushToken,
              updated_at: now,
            }),
          )
          .returning(['enabled', 'id', 'platform', 'provider'])
          .executeTakeFirstOrThrow();

        const enabledDevices = await transaction
          .selectFrom('push_devices')
          .select('id')
          .where('user_id', '=', context.userId)
          .where('enabled', '=', true)
          .orderBy('last_registered_at', 'desc')
          .orderBy('id', 'desc')
          .execute();
        for (const stale of enabledDevices.slice(maximumDevicesPerUser)) {
          await this.disableDeviceRow(transaction, stale.id, now);
        }
        return device;
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        return { userId: user.id };
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
        const now = new Date();
        const result = await transaction
          .updateTable('push_devices')
          .set({
            disabled_at: now,
            enabled: false,
            push_token: null,
            updated_at: now,
          })
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
    const now = new Date();
    await transaction
      .insertInto('notification_deliveries')
      .values({
        attempt_count: 0,
        completed_device_ids: [],
        created_at: now,
        dedupe_key: notificationDedupeKey(template, payload),
        delivered_count: 0,
        last_error: null,
        payload,
        scheduled_at: now,
        sent_at: null,
        status: 'pending',
        target_device_ids: null,
        template,
        updated_at: now,
        user_id: userId,
      })
      .onConflict((conflict) =>
        conflict.columns(['user_id', 'dedupe_key']).doNothing(),
      )
      .executeTakeFirst();
  }

  async processPending(limit = 50): Promise<number> {
    if (!this.pushEnabled) return 0;
    const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    let sent = 0;

    for (let index = 0; index < boundedLimit; index += 1) {
      const delivery = await this.claimNextDelivery(new Date());
      if (!delivery) break;

      const completed = new Set(delivery.completed_device_ids);
      const remainingTargets = delivery.target_device_ids.filter(
        (deviceId) => !completed.has(deviceId),
      );
      const devices = await this.loadDeliveryDevices(
        delivery.user_id,
        remainingTargets,
      );
      const activeIds = new Set(devices.map((device) => device.id));
      const unavailableDeviceIds = remainingTargets.filter(
        (deviceId) => !activeIds.has(deviceId),
      );

      if (devices.length === 0) {
        const terminal = await this.recordDeliveryResults(
          delivery,
          [],
          unavailableDeviceIds,
          null,
        );
        if (terminal === 'sent') sent += 1;
        continue;
      }

      try {
        const content = renderNotification(
          delivery.template,
          this.toJsonObject(delivery.payload),
        );
        const results = await this.pushClient.send(
          devices.map((device) => ({
            ...content,
            data: { ...content.data, notificationId: delivery.id },
            to: device.push_token,
          })),
        );
        if (results.length !== devices.length) throw new PushProviderError();
        const terminal = await this.recordDeliveryResults(
          delivery,
          devices.map((device, resultIndex) => ({
            device,
            result: results[resultIndex],
          })),
          unavailableDeviceIds,
          null,
        );
        if (terminal === 'sent') sent += 1;
      } catch (error) {
        await this.recordDeliveryResults(
          delivery,
          [],
          unavailableDeviceIds,
          this.safeError(error),
        );
      }
    }
    return sent;
  }

  private claimNextDelivery(now: Date): Promise<ClaimedNotification | null> {
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(
      now.getTime() + notificationLeaseMilliseconds,
    );
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const candidate = await transaction
          .selectFrom('notification_deliveries')
          .select(['id', 'target_device_ids', 'user_id'])
          .where('status', 'in', ['pending', 'failed'])
          .where('attempt_count', '<', maximumDeliveryAttempts)
          .where('scheduled_at', '<=', now)
          .where((expression) =>
            expression.or([
              expression('lease_expires_at', 'is', null),
              expression('lease_expires_at', '<=', now),
            ]),
          )
          .orderBy('scheduled_at')
          .orderBy('id')
          .forUpdate()
          .skipLocked()
          .executeTakeFirst();
        if (!candidate) return null;

        const targetDeviceIds =
          candidate.target_device_ids ??
          (
            await transaction
              .selectFrom('push_devices')
              .select('id')
              .where('user_id', '=', candidate.user_id)
              .where('enabled', '=', true)
              .orderBy('last_registered_at', 'desc')
              .orderBy('id', 'desc')
              .limit(maximumDevicesPerUser)
              .execute()
          ).map((device) => device.id);
        const claimed = await transaction
          .updateTable('notification_deliveries')
          .set({
            attempt_count: (expression) => expression('attempt_count', '+', 1),
            lease_expires_at: leaseExpiresAt,
            lease_token: leaseToken,
            target_device_ids: targetDeviceIds,
            updated_at: now,
          })
          .where('id', '=', candidate.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        return {
          ...claimed,
          lease_token: leaseToken,
          target_device_ids: targetDeviceIds,
        };
      });
  }

  private async loadDeliveryDevices(
    userId: string,
    deviceIds: readonly string[],
  ): Promise<DeliveryDevice[]> {
    if (deviceIds.length === 0) return [];
    const devices = await this.database.connection
      .selectFrom('push_devices')
      .select(['id', 'push_token'])
      .where('id', 'in', [...deviceIds])
      .where('user_id', '=', userId)
      .where('enabled', '=', true)
      .where('push_token', 'is not', null)
      .execute();
    return devices.filter(
      (device): device is DeliveryDevice =>
        typeof device.push_token === 'string',
    );
  }

  private async recordDeliveryResults(
    delivery: ClaimedNotification,
    deviceResults: readonly {
      device: DeliveryDevice;
      result: PushSendResult;
    }[],
    unavailableDeviceIds: readonly string[],
    failureCode: string | null,
  ): Promise<'cancelled' | 'failed' | 'lost' | 'sent'> {
    const acceptedDeviceIds = deviceResults
      .filter(({ result }) => result.status === 'accepted')
      .map(({ device }) => device.id);
    const invalidDeviceIds = deviceResults
      .filter(({ result }) => result.status === 'invalid-token')
      .map(({ device }) => device.id);
    const retryable =
      failureCode !== null ||
      deviceResults.some(({ result }) => result.status === 'retryable-failure');
    const completedDeviceIds = Array.from(
      new Set([
        ...delivery.completed_device_ids,
        ...acceptedDeviceIds,
        ...invalidDeviceIds,
        ...unavailableDeviceIds,
      ]),
    );
    const deliveredCount = delivery.delivered_count + acceptedDeviceIds.length;
    const remainingCount = delivery.target_device_ids.filter(
      (deviceId) => !completedDeviceIds.includes(deviceId),
    ).length;
    const status =
      retryable || remainingCount > 0
        ? 'failed'
        : deliveredCount > 0
          ? 'sent'
          : 'cancelled';
    const now = new Date();
    const scheduledAt =
      status === 'failed'
        ? new Date(
            now.getTime() +
              (retryBackoffMilliseconds[delivery.attempt_count - 1] ??
                retryBackoffMilliseconds.at(-1)!),
          )
        : delivery.scheduled_at;

    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const updated = await transaction
          .updateTable('notification_deliveries')
          .set({
            completed_device_ids: completedDeviceIds,
            delivered_count: deliveredCount,
            last_error:
              status === 'failed'
                ? (failureCode ?? 'PUSH_PROVIDER_RETRYABLE')
                : null,
            lease_expires_at: null,
            lease_token: null,
            scheduled_at: scheduledAt,
            sent_at: status === 'sent' ? now : null,
            status,
            updated_at: now,
          })
          .where('id', '=', delivery.id)
          .where('lease_token', '=', delivery.lease_token)
          .returning('id')
          .executeTakeFirst();
        if (!updated) return 'lost';

        for (const deviceId of invalidDeviceIds) {
          await this.disableDeviceRow(transaction, deviceId, now);
        }
        return status;
      });
  }

  private disableDeviceRow(
    transaction: Transaction<Database>,
    deviceId: string,
    now: Date,
  ) {
    return transaction
      .updateTable('push_devices')
      .set({
        disabled_at: now,
        enabled: false,
        push_token: null,
        updated_at: now,
      })
      .where('id', '=', deviceId)
      .executeTakeFirst();
  }

  private toJsonObject(value: unknown): JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private safeError(error: unknown): string {
    return error instanceof PushProviderError
      ? error.code
      : 'PUSH_DELIVERY_FAILED';
  }
}
