import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';

export interface SocialInvitationCleanupResult {
  expired: number;
  purged: number;
}

const RETENTION_DAYS_AFTER_RESOLUTION = 90;

@Injectable()
export class SocialInvitationCleanupService {
  constructor(private readonly database: DatabaseService) {}

  async process(limit = 500): Promise<SocialInvitationCleanupResult> {
    const now = new Date();
    const expired = await this.database.connection
      .updateTable('challenge_contact_invitations')
      .set({ status: 'expired' })
      .where('id', 'in', (query) =>
        query
          .selectFrom('challenge_contact_invitations')
          .select('id')
          .where('status', '=', 'pending')
          .where('expires_at', '<=', now)
          .orderBy('expires_at')
          .limit(limit),
      )
      .returning('id')
      .execute();

    const retentionCutoff = sql<Date>`
      ${now}::timestamptz - make_interval(days => ${RETENTION_DAYS_AFTER_RESOLUTION})
    `;
    const purgeCandidates = await this.database.connection
      .selectFrom('challenge_contact_invitations')
      .select('id')
      .where((expression) =>
        expression.or([
          expression.and([
            expression('status', 'in', ['expired', 'revoked']),
            expression('expires_at', '<', retentionCutoff),
          ]),
          expression.and([
            expression('status', '=', 'claimed'),
            expression('claimed_at', '<', retentionCutoff),
          ]),
        ]),
      )
      .orderBy('expires_at')
      .limit(limit)
      .execute();
    const purged =
      purgeCandidates.length === 0
        ? []
        : await this.database.connection
            .deleteFrom('challenge_contact_invitations')
            .where(
              'id',
              'in',
              purgeCandidates.map((candidate) => candidate.id),
            )
            .returning('id')
            .execute();

    return { expired: expired.length, purged: purged.length };
  }
}
