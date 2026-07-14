import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Transaction } from 'kysely';
import type { Database, JsonArray } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import { stableJson } from '../../common/idempotency/stable-json';
import { parseCompetitionRules } from '../competitions/competition-rules';
import { PayoutsService } from '../payouts/payouts.service';
import {
  buildPayoutLadder,
  buildSeedCommitment,
  selectWeightedWinners,
} from './draw-algorithm';

export interface LockDrawInput {
  competitionId: string;
  operatorUserId: string;
  reason: string;
  requestId: string;
  seedCommitment: string;
}

export interface LockedDrawResult {
  drawId: string;
  entrantCount: number;
  entrantSnapshotHash: string;
  totalEntries: string;
}

export interface SettleDrawInput {
  drawId: string;
  operatorUserId: string;
  reason: string;
  requestId: string;
  seedReveal: string;
}

export interface SettledDrawResult {
  drawId: string;
  payoutPoolAmountMinor: number;
  winnerCount: number;
}

@Injectable()
export class DrawsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly payouts: PayoutsService,
  ) {}

  async lock(input: LockDrawInput): Promise<LockedDrawResult> {
    if (!/^[a-f0-9]{64}$/i.test(input.seedCommitment)) {
      throw new ConflictException({
        code: 'INVALID_DRAW_COMMITMENT',
        message:
          'The draw seed commitment must be a 32-byte SHA-256 hexadecimal digest.',
      });
    }

    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const competition = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', input.competitionId)
          .forUpdate()
          .executeTakeFirst();
        if (!competition) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        if (competition.mode === 'non_cash_demo') {
          throw new ConflictException({
            code: 'DEMO_COMPETITION_DRAWS_DISABLED',
            message:
              'Draw creation is disabled for non-cash demo competitions.',
          });
        }

        const existing = await transaction
          .selectFrom('competition_draws')
          .selectAll()
          .where('competition_id', '=', competition.id)
          .executeTakeFirst();
        if (existing) {
          if (existing.seed_commitment !== input.seedCommitment.toLowerCase()) {
            throw new ConflictException({
              code: 'DRAW_ALREADY_LOCKED',
              message:
                'This competition already has a draw locked with a different seed commitment.',
            });
          }
          return {
            drawId: existing.id,
            entrantCount: existing.entrant_count,
            entrantSnapshotHash: existing.entrant_snapshot_hash,
            totalEntries: existing.total_entries,
          };
        }
        if (
          competition.status !== 'active' ||
          new Date() < competition.ends_at
        ) {
          throw new ConflictException({
            code: 'COMPETITION_NOT_READY_TO_SETTLE',
            message:
              'Only an ended active competition can lock its entrant snapshot.',
          });
        }

        const unresolvedSessions = await transaction
          .selectFrom('workout_sessions')
          .select((expression) => expression.fn.countAll<number>().as('count'))
          .where('competition_id', '=', competition.id)
          .where('status', 'in', ['active', 'pending_review'])
          .executeTakeFirstOrThrow();
        if (Number(unresolvedSessions.count) > 0) {
          throw new ConflictException({
            code: 'COMPETITION_SESSION_REVIEWS_PENDING',
            message:
              'The competition cannot lock a draw while workout sessions remain active or pending review.',
          });
        }

        const activeEnrollments = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin('users as user', 'user.id', 'enrollment.user_id')
          .select((expression) => expression.fn.countAll<number>().as('count'))
          .where('enrollment.competition_id', '=', competition.id)
          .where('enrollment.status', '=', 'active')
          .where('user.email', 'is not', null)
          .where('user.email_verified', '=', true)
          .where('user.status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (Number(activeEnrollments.count) < competition.minimum_entrants) {
          throw new ConflictException({
            code: 'COMPETITION_MINIMUM_ENTRANTS_NOT_MET',
            message:
              'The competition cannot lock a draw before its minimum active entrant count is met.',
          });
        }

        const progress = await transaction
          .selectFrom('competition_progress as progress')
          .innerJoin(
            'competition_enrollments as enrollment',
            'enrollment.id',
            'progress.enrollment_id',
          )
          .innerJoin('users as user', 'user.id', 'progress.user_id')
          .select([
            'progress.enrollment_id',
            'progress.prize_draw_entries',
            'progress.user_id',
          ])
          .where('progress.competition_id', '=', competition.id)
          .where('enrollment.competition_id', '=', competition.id)
          .where('enrollment.status', '=', 'active')
          .where('progress.prize_draw_entries', '>', 0)
          .where('user.email', 'is not', null)
          .where('user.email_verified', '=', true)
          .where('user.status', '=', 'active')
          .orderBy('progress.user_id')
          .execute();
        if (progress.length === 0) {
          throw new ConflictException({
            code: 'DRAW_HAS_NO_ENTRANTS',
            message: 'The competition has no eligible draw entries.',
          });
        }

        const snapshot: JsonArray = progress.map((entry, index) => ({
          entryCount: entry.prize_draw_entries,
          position: index + 1,
          userId: entry.user_id,
        }));
        const entrantSnapshotHash = createHash('sha256')
          .update(stableJson(snapshot))
          .digest('hex');
        const totalEntries = progress.reduce(
          (total, entry) => total + BigInt(entry.prize_draw_entries),
          0n,
        );
        const draw = await transaction
          .insertInto('competition_draws')
          .values({
            competition_id: competition.id,
            entrant_count: progress.length,
            entrant_snapshot_hash: entrantSnapshotHash,
            locked_at: new Date(),
            rules_version: competition.rules_version,
            seed_commitment: input.seedCommitment.toLowerCase(),
            status: 'locked',
            total_entries: totalEntries,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('draw_entries')
          .values(
            progress.map((entry, index) => ({
              created_at: new Date(),
              draw_id: draw.id,
              enrollment_id: entry.enrollment_id,
              entry_count: entry.prize_draw_entries,
              snapshot_position: index + 1,
              user_id: entry.user_id,
            })),
          )
          .execute();
        await transaction
          .updateTable('competitions')
          .set({ status: 'settling', updated_at: new Date() })
          .where('id', '=', competition.id)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        await this.appendAudit(transaction, {
          action: 'draw.locked',
          actorUserId: input.operatorUserId,
          entityId: draw.id,
          nextState: {
            entrantCount: progress.length,
            entrantSnapshotHash,
            status: 'locked',
          },
          previousState: null,
          reason: input.reason,
          requestId: input.requestId,
        });

        return {
          drawId: draw.id,
          entrantCount: progress.length,
          entrantSnapshotHash,
          totalEntries: totalEntries.toString(),
        };
      });
  }

  async settle(input: SettleDrawInput): Promise<SettledDrawResult> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const draw = await transaction
          .selectFrom('competition_draws as draw')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'draw.competition_id',
          )
          .select([
            'competition.currency',
            'competition.rules',
            'competition.status as competition_status',
            'draw.competition_id',
            'draw.id',
            'draw.seed_commitment',
            'draw.seed_reveal',
            'draw.status',
          ])
          .where('draw.id', '=', input.drawId)
          .forUpdate()
          .executeTakeFirst();
        if (!draw) {
          throw new NotFoundException({
            code: 'DRAW_NOT_FOUND',
            message: 'The draw was not found.',
          });
        }
        if (draw.status === 'settled') {
          if (draw.seed_reveal !== input.seedReveal.toLowerCase()) {
            throw new ConflictException({
              code: 'DRAW_ALREADY_SETTLED',
              message:
                'This draw was already settled with a different seed reveal.',
            });
          }
          const count = await transaction
            .selectFrom('draw_winners')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('draw_id', '=', draw.id)
            .executeTakeFirstOrThrow();
          const rules = parseCompetitionRules(draw.rules);
          return {
            drawId: draw.id,
            payoutPoolAmountMinor: rules.payoutPoolAmountMinor,
            winnerCount: Number(count.count),
          };
        }
        if (
          draw.status !== 'locked' ||
          draw.competition_status !== 'settling'
        ) {
          throw new ConflictException({
            code: 'DRAW_NOT_SETTLEABLE',
            message:
              'Only a locked draw for a settling competition can be settled.',
          });
        }
        if (buildSeedCommitment(input.seedReveal) !== draw.seed_commitment) {
          throw new ConflictException({
            code: 'DRAW_SEED_COMMITMENT_MISMATCH',
            message:
              'The revealed draw seed does not match the locked commitment.',
          });
        }

        const entries = await transaction
          .selectFrom('draw_entries')
          .select(['entry_count', 'user_id'])
          .where('draw_id', '=', draw.id)
          .orderBy('snapshot_position')
          .execute();
        const rules = parseCompetitionRules(draw.rules);
        const winnerCount = Math.min(rules.payoutWinnerCount, entries.length);
        const winners = selectWeightedWinners(
          entries.map((entry) => ({
            entryCount: entry.entry_count,
            userId: entry.user_id,
          })),
          winnerCount,
          input.seedReveal,
        );
        const ladder = buildPayoutLadder(
          rules.payoutPoolAmountMinor,
          winnerCount,
          rules.payoutExponent,
        );
        const now = new Date();
        const insertedWinners = await transaction
          .insertInto('draw_winners')
          .values(
            winners.map((winner, index) => ({
              amount_minor: ladder[index].amountMinor,
              created_at: now,
              currency: draw.currency,
              draw_id: draw.id,
              payout_rank: index + 1,
              user_id: winner.userId,
            })),
          )
          .returning(['amount_minor', 'currency', 'id', 'user_id'])
          .execute();
        await this.payouts.createClaimsForWinners(
          transaction,
          insertedWinners.map((winner) => ({
            amountMinor: winner.amount_minor,
            currency: winner.currency,
            id: winner.id,
            userId: winner.user_id,
          })),
        );
        await transaction
          .updateTable('competition_draws')
          .set({
            seed_reveal: input.seedReveal.toLowerCase(),
            settled_at: now,
            status: 'settled',
          })
          .where('id', '=', draw.id)
          .where('status', '=', 'locked')
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable('competitions')
          .set({ status: 'settled', updated_at: now })
          .where('id', '=', draw.competition_id)
          .where('status', '=', 'settling')
          .executeTakeFirstOrThrow();
        await this.appendAudit(transaction, {
          action: 'draw.settled',
          actorUserId: input.operatorUserId,
          entityId: draw.id,
          nextState: { status: 'settled', winnerCount },
          previousState: { status: 'locked' },
          reason: input.reason,
          requestId: input.requestId,
        });

        return {
          drawId: draw.id,
          payoutPoolAmountMinor: rules.payoutPoolAmountMinor,
          winnerCount,
        };
      });
  }

  private async appendAudit(
    transaction: Transaction<Database>,
    event: {
      action: string;
      actorUserId: string;
      entityId: string;
      nextState: Record<string, boolean | number | string>;
      previousState: Record<string, boolean | number | string> | null;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('operator_audit_events')
      .values({
        action: event.action,
        actor_user_id: event.actorUserId,
        created_at: new Date(),
        entity_id: event.entityId,
        entity_type: 'competition_draws',
        next_state: event.nextState,
        previous_state: event.previousState,
        reason: event.reason,
        request_id: event.requestId,
      })
      .executeTakeFirstOrThrow();
  }
}
