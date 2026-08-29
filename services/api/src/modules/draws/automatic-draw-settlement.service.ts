import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { canLockCompetitionDraw } from './draw-policy';
import { buildSeedCommitment } from './draw-algorithm';
import { DrawsService } from './draws.service';

@Injectable()
export class AutomaticDrawSettlementService {
  constructor(
    private readonly database: DatabaseService,
    private readonly draws: DrawsService,
  ) {}

  async processDueCompetitions(limit = 20, now = new Date()): Promise<number> {
    if (limit <= 0) return 0;
    const competitions = await this.database.connection
      .selectFrom('competitions')
      .select(['ends_at', 'id', 'status'])
      .where('status', '=', 'active')
      .where('deleted_at', 'is', null)
      .where('ends_at', '<=', now)
      .orderBy('ends_at')
      .orderBy('id')
      .execute();
    const due = competitions
      .filter((competition) =>
        canLockCompetitionDraw({
          competitionEndsAt: competition.ends_at,
          competitionStatus: competition.status,
          now,
        }),
      )
      .slice(0, limit);
    const failures: unknown[] = [];
    let settled = 0;

    for (const competition of due) {
      try {
        await this.database.connection
          .transaction()
          .execute(async (transaction) => {
            const seedReveal = randomBytes(32).toString('hex');
            const locked = await this.draws.lock(
              transaction,
              {
                competitionId: competition.id,
                operatorUserId: null,
                reason:
                  'Automatically finalized after the Contest and workout completion windows closed.',
                requestId: `automatic-draw-lock:${competition.id}`,
                seedCommitment: buildSeedCommitment(seedReveal),
              },
              now,
            );
            await this.draws.settle(
              transaction,
              {
                drawId: locked.drawId,
                operatorUserId: null,
                reason:
                  'Automatically published after audited scoring and draw validation completed.',
                requestId: `automatic-draw-settle:${competition.id}`,
                seedReveal,
              },
              now,
            );
          });
        settled += 1;
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `${failures.length} automatic Contest settlement(s) failed.`,
      );
    }
    return settled;
  }
}
