import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';

@Injectable()
export class AdminAuthorizationService {
  constructor(private readonly profiles: ProfilesService) {}

  async requireAdmin(
    principal: AuthenticatedPrincipal,
    transaction: Transaction<Database>,
  ) {
    const user = await this.profiles.ensureUser(principal, transaction);
    if (!user.roles.includes('admin')) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'An administrator role is required for configuration changes.',
      });
    }
    return user;
  }

  async audit(
    transaction: Transaction<Database>,
    input: {
      action: string;
      actorUserId: string;
      entityId: string;
      entityType: string;
      nextState: JsonObject;
      previousState: JsonObject | null;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('operator_audit_events')
      .values({
        action: input.action,
        actor_user_id: input.actorUserId,
        created_at: new Date(),
        entity_id: input.entityId,
        entity_type: input.entityType,
        next_state: input.nextState,
        previous_state: input.previousState,
        reason: input.reason.trim(),
        request_id: input.requestId,
      })
      .executeTakeFirstOrThrow();
  }
}
