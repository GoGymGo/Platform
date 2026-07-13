import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { Kysely, Selectable, Transaction } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type {
  Database,
  JsonObject,
  JsonValue,
  ProfilesTable,
  UsersTable,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type {
  MeResponseDto,
  PrivacySettingsDto,
  UpdateMeDto,
} from './dto/profile.dto';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

@Injectable()
export class ProfilesService {
  constructor(private readonly database: DatabaseService) {}

  async getMe(principal: AuthenticatedPrincipal): Promise<MeResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.ensureUser(principal, transaction);
        const profile = await this.ensureProfile(user.id, transaction);
        return this.toResponse(user, profile);
      });
  }

  async updateMe(
    principal: AuthenticatedPrincipal,
    update: UpdateMeDto,
  ): Promise<MeResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.ensureUser(principal, transaction);
        const current = await this.ensureProfile(user.id, transaction);
        const publicIdentityMode =
          update.publicIdentityMode ?? current.public_identity_mode;
        const publicName =
          update.publicName === undefined
            ? current.public_name
            : update.publicName?.trim() || null;

        if (publicIdentityMode !== 'private' && !publicName) {
          throw new BadRequestException({
            code: 'PUBLIC_NAME_REQUIRED',
            message:
              'A public name is required for alias or real-name identity mode.',
          });
        }

        const privacySettings = {
          ...this.normalizePrivacySettings(current.privacy_settings),
          ...update.privacySettings,
        } satisfies PrivacySettingsDto;
        const profile = await transaction
          .updateTable('profiles')
          .set({
            privacy_settings: privacySettings,
            public_identity_mode: publicIdentityMode,
            public_name: publicName,
            updated_at: new Date(),
            version: sql<number>`version + 1`,
          })
          .where('user_id', '=', user.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        return this.toResponse(user, profile);
      });
  }

  async ensureUser(
    principal: AuthenticatedPrincipal,
    executor: DatabaseExecutor,
  ): Promise<Selectable<UsersTable>> {
    const now = new Date();
    const user = await executor
      .insertInto('users')
      .values({
        created_at: now,
        email: principal.email ?? null,
        email_verified: principal.emailVerified,
        firebase_uid: principal.firebaseUid,
        roles: principal.roles.length > 0 ? principal.roles : ['user'],
        status: 'active',
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.column('firebase_uid').doUpdateSet({
          email: principal.email ?? null,
          email_verified: principal.emailVerified,
          updated_at: now,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    if (user.status !== 'active') {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'This account is not active.',
      });
    }

    return user;
  }

  private async ensureProfile(
    userId: string,
    executor: DatabaseExecutor,
  ): Promise<Selectable<ProfilesTable>> {
    const now = new Date();
    await executor
      .insertInto('profiles')
      .values({
        callsign: this.buildCallsign(userId),
        created_at: now,
        privacy_settings: { showRegion: false, showStats: true },
        public_identity_mode: 'private',
        public_name: null,
        updated_at: now,
        user_id: userId,
        version: 1,
      })
      .onConflict((conflict) => conflict.column('user_id').doNothing())
      .execute();

    return executor
      .selectFrom('profiles')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
  }

  private buildCallsign(userId: string): string {
    const suffix = createHash('sha256')
      .update(userId)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
    return `GG-${suffix}`;
  }

  private normalizePrivacySettings(value: JsonValue): PrivacySettingsDto {
    const settings = this.isJsonObject(value) ? value : {};
    return {
      showRegion: settings.showRegion === true,
      showStats: settings.showStats !== false,
    };
  }

  private isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toResponse(
    user: Selectable<UsersTable>,
    profile: Selectable<ProfilesTable>,
  ): MeResponseDto {
    return {
      callsign: profile.callsign,
      email: user.email,
      emailVerified: user.email_verified,
      id: user.id,
      privacySettings: this.normalizePrivacySettings(profile.privacy_settings),
      publicIdentityMode: profile.public_identity_mode,
      publicName: profile.public_name,
      roles: user.roles,
      status: user.status,
      version: profile.version,
    };
  }
}
