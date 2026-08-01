import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  SetVerificationConsentDto,
  VerificationConsentStatusResponseDto,
} from './dto/legal.dto';
import {
  buildVerificationConsentStatus,
  devicePresenceConsentKey,
  devicePresenceConsentVersion,
} from './verification-consent';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

@Injectable()
export class VerificationConsentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  async getStatus(
    principal: AuthenticatedPrincipal,
  ): Promise<VerificationConsentStatusResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        return this.buildStatus(transaction, user.id);
      });
  }

  async setStatus(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: SetVerificationConsentDto,
  ): Promise<VerificationConsentStatusResponseDto> {
    if (input.consentVersion !== devicePresenceConsentVersion) {
      throw new ConflictException({
        code: 'VERIFICATION_CONSENT_VERSION_STALE',
        message:
          'The verification consent notice has changed and must be reviewed again.',
      });
    }

    const result = await this.idempotency.execute<JsonObject>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 200,
        scope: 'account-verification-consent:set',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const action = input.accepted ? 'granted' : 'withdrawn';
        const current = await this.getCurrentEvent(transaction, user.id);

        if (
          current?.action !== action ||
          current.consent_version !== input.consentVersion
        ) {
          await transaction
            .insertInto('account_verification_consent_events')
            .values({
              action,
              consent_key: devicePresenceConsentKey,
              consent_version: input.consentVersion,
              request_id: idempotencyKey,
              user_id: user.id,
            })
            .execute();
        }

        return (await this.buildStatus(
          transaction,
          user.id,
        )) as unknown as JsonObject;
      },
    );

    return result as unknown as VerificationConsentStatusResponseDto;
  }

  async assertActiveDevicePresenceConsent(
    executor: DatabaseExecutor,
    userId: string,
  ): Promise<void> {
    const status = await this.buildStatus(executor, userId);
    if (!status.accepted) {
      throw new UnprocessableEntityException({
        code: 'DEVICE_PRESENCE_CONSENT_REQUIRED',
        message:
          'Current device-presence consent is required for competition registration and verified workouts.',
      });
    }
  }

  private async buildStatus(
    executor: DatabaseExecutor,
    userId: string,
  ): Promise<VerificationConsentStatusResponseDto> {
    return buildVerificationConsentStatus(
      await this.getCurrentEvent(executor, userId),
    );
  }

  private getCurrentEvent(executor: DatabaseExecutor, userId: string) {
    return executor
      .selectFrom('account_verification_consent_events')
      .select(['action', 'consent_version', 'created_at'])
      .where('user_id', '=', userId)
      .where('consent_key', '=', devicePresenceConsentKey)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
  }
}
