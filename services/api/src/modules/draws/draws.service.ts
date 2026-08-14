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
import { CompetitionScoringService } from '../competitions/competition-scoring.service';
import { RewardsService } from '../rewards/rewards.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildSeedCommitment, selectWeightedWinners } from './draw-algorithm';

const drawInsertBatchSize = 1_000;

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
  scoringSnapshotHash: string;
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
  winnerCount: number;
}

@Injectable()
export class DrawsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly rewards: RewardsService,
    private readonly scoring: CompetitionScoringService,
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
            scoringSnapshotHash: existing.scoring_snapshot_hash,
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

        const finalizedScoring = await this.scoring.finalizeForDraw(
          transaction,
          competition.id,
          new Date(),
        );

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

        const progress = finalizedScoring.settlementInputs;
        if (progress.length === 0) {
          throw new ConflictException({
            code: 'DRAW_HAS_NO_ENTRANTS',
            message: 'The competition has no eligible draw entries.',
          });
        }

        const snapshot: JsonArray = progress.map((entry, index) => ({
          entryCount: entry.prizeDrawEntries,
          position: index + 1,
          userId: entry.userId,
        }));
        const entrantSnapshotHash = createHash('sha256')
          .update(stableJson(snapshot))
          .digest('hex');
        const scoringSnapshot: JsonArray = progress.map((entry, index) => ({
          categoryRank: entry.categoryRank,
          categoryScore: entry.categoryScore,
          enrollmentId: entry.enrollmentId,
          goalDays: entry.goalDays,
          longestStreak: entry.longestStreak,
          position: index + 1,
          prizeDrawEntries: entry.prizeDrawEntries,
          rulesVersion: entry.rulesVersion,
          tieBreakDigest: entry.tieBreakDigest,
          userId: entry.userId,
          verifiedDays: entry.verifiedDays,
        }));
        const scoringSnapshotHash = createHash('sha256')
          .update(stableJson(scoringSnapshot))
          .digest('hex');
        const totalEntries = progress.reduce(
          (total, entry) => total + BigInt(entry.prizeDrawEntries),
          0n,
        );
        const draw = await transaction
          .insertInto('competition_draws')
          .values({
            competition_id: competition.id,
            entrant_count: progress.length,
            entrant_snapshot_hash: entrantSnapshotHash,
            scoring_snapshot_hash: scoringSnapshotHash,
            locked_at: new Date(),
            rules_version: competition.rules_version,
            seed_commitment: input.seedCommitment.toLowerCase(),
            status: 'locked',
            total_entries: totalEntries,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('competition_settlement_inputs')
          .values(
            progress.map((entry, index) => ({
              category_rank: entry.categoryRank,
              category_score: entry.categoryScore,
              competition_id: competition.id,
              draw_id: draw.id,
              enrollment_id: entry.enrollmentId,
              goal_days: entry.goalDays,
              longest_streak: entry.longestStreak,
              prize_draw_entries: entry.prizeDrawEntries,
              rules_version: entry.rulesVersion,
              snapshot_position: index + 1,
              tie_break_digest: entry.tieBreakDigest,
              user_id: entry.userId,
              verified_days: entry.verifiedDays,
            })),
          )
          .execute();
        for (
          let offset = 0;
          offset < progress.length;
          offset += drawInsertBatchSize
        ) {
          const batch = progress.slice(offset, offset + drawInsertBatchSize);
          await transaction
            .insertInto('draw_entries')
            .values(
              batch.map((entry, batchIndex) => ({
                created_at: new Date(),
                draw_id: draw.id,
                enrollment_id: entry.enrollmentId,
                entry_count: entry.prizeDrawEntries,
                snapshot_position: offset + batchIndex + 1,
                user_id: entry.userId,
              })),
            )
            .execute();
        }
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
            progressRowsReconciled: finalizedScoring.reconciledProgressRows,
            scoringSnapshotHash,
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
          scoringSnapshotHash,
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
            .selectFrom('reward_awards')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('draw_id', '=', draw.id)
            .executeTakeFirstOrThrow();
          return {
            drawId: draw.id,
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
        const now = new Date();
        const rewardSlots = await this.rewards.listAvailableAwardSlots(
          transaction,
          draw.competition_id,
          now,
          entries.length,
        );
        const winnerCount = Math.min(rewardSlots.length, entries.length);
        if (winnerCount === 0) {
          throw new ConflictException({
            code: 'DRAW_REWARD_INVENTORY_REQUIRED',
            message:
              'Publish at least one in-stock reward before settling the draw.',
          });
        }
        const winners = selectWeightedWinners(
          entries.map((entry) => ({
            entryCount: entry.entry_count,
            userId: entry.user_id,
          })),
          winnerCount,
          input.seedReveal,
        );
        const awards: { id: string; user_id: string }[] = [];
        for (
          let offset = 0;
          offset < winners.length;
          offset += drawInsertBatchSize
        ) {
          const batch = winners.slice(offset, offset + drawInsertBatchSize);
          const inserted = await transaction
            .insertInto('reward_awards')
            .values(
              batch.map((winner, batchIndex) => ({
                award_rank: offset + batchIndex + 1,
                awarded_at: now,
                claimed_at: null,
                draw_id: draw.id,
                fulfilled_at: null,
                redeemed_at: null,
                reward_catalog_item_id:
                  rewardSlots[offset + batchIndex].rewardCatalogItemId,
                status: 'awarded' as const,
                updated_at: now,
                user_id: winner.userId,
              })),
            )
            .returning(['id', 'user_id'])
            .execute();
          awards.push(...inserted);
        }
        for (const award of awards) {
          await this.notifications.enqueue(
            transaction,
            award.user_id,
            'reward_awarded',
            { awardId: award.id },
          );
        }
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
