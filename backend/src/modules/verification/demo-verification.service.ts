import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { JsonObject } from '../../database/database.types';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CreateDemoCheckInDto,
  DemoCheckInResponseDto,
} from './dto/demo-check-in.dto';

interface DemoCheckInJson extends JsonObject {
  checkpointType: 'session_start';
  demo: true;
  expiresAt: string;
  id: string;
  issuedAt: string;
  outcome: 'simulated';
  provider: 'canada_demo';
  regionCode: string;
}

@Injectable()
export class DemoVerificationService {
  private readonly enabled: boolean;
  private readonly regionCode: string;
  private readonly ttlSeconds: number;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {
    this.enabled = config.get('DEMO_VERIFICATION_ENABLED', { infer: true });
    this.regionCode = config.get('DEMO_VERIFICATION_REGION_CODE', {
      infer: true,
    });
    this.ttlSeconds = config.get('DEMO_VERIFICATION_TTL_SECONDS', {
      infer: true,
    });
  }

  async createCheckIn(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    request: CreateDemoCheckInDto,
  ): Promise<DemoCheckInResponseDto> {
    if (!this.enabled) {
      throw new ServiceUnavailableException({
        code: 'DEMO_VERIFICATION_DISABLED',
        message: 'The local demo verification adapter is disabled.',
      });
    }
    if (request.regionCode !== this.regionCode) {
      throw new UnprocessableEntityException({
        code: 'DEMO_VERIFICATION_REGION_UNAVAILABLE',
        message: `The demo verification adapter is restricted to ${this.regionCode}.`,
      });
    }

    return this.idempotency.execute<DemoCheckInJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          checkpointType: request.checkpointType,
          regionCode: request.regionCode,
        },
        responseCode: 201,
        scope: 'demo-verification:check-in',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        this.profiles.requireVerifiedEmail(user);
        const issuedAt = new Date();
        const expiresAt = new Date(
          issuedAt.getTime() + this.ttlSeconds * 1_000,
        );
        const checkpoint = await transaction
          .insertInto('demo_verification_checkpoints')
          .values({
            checkpoint_type: request.checkpointType,
            created_at: issuedAt,
            demo: true,
            expires_at: expiresAt,
            issued_at: issuedAt,
            outcome: 'simulated',
            provider: 'canada_demo',
            region_code: request.regionCode,
            user_id: user.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return {
          checkpointType: checkpoint.checkpoint_type,
          demo: true,
          expiresAt: checkpoint.expires_at.toISOString(),
          id: checkpoint.id,
          issuedAt: checkpoint.issued_at.toISOString(),
          outcome: checkpoint.outcome,
          provider: checkpoint.provider,
          regionCode: checkpoint.region_code,
        };
      },
    );
  }
}
