import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PartnerApplicationRetentionService {
  constructor(private readonly database: DatabaseService) {}

  purgeExpired(limit = 100, now = new Date()): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new RangeError('Partner application retention limit is invalid.');
    }
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const deleted = await transaction
          .deleteFrom('partner_applications')
          .where('id', 'in', (query) =>
            query
              .selectFrom('partner_applications')
              .select('id')
              .where('user_id', 'is', null)
              .where('retention_expires_at', 'is not', null)
              .where('retention_expires_at', '<=', now)
              .orderBy('retention_expires_at')
              .orderBy('id')
              .limit(limit),
          )
          .returning('id')
          .execute();
        return deleted.length;
      });
  }
}
