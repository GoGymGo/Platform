import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Transaction } from 'kysely';
import { stableJson } from '../../common/idempotency/stable-json';
import type { Database, JsonArray } from '../../database/database.types';
import { CompetitionScoringService } from '../competitions/competition-scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  type RewardAwardSlot,
  RewardsService,
} from '../rewards/rewards.service';
import { loadPublicStreaks } from '../streaks/public-streaks';
import { buildSeedCommitment, selectWeightedWinners } from './draw-algorithm';
import { canLockCompetitionDraw } from './draw-policy';

const drawInsertBatchSize = 1_000;
const canonicalDigestPattern = /^[0-9a-f]{64}$/;

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
  lockedAt: string;
  publicResultSnapshotHash: string;
  rewardSlotCount: number;
  rewardSnapshotHash: string;
  scoringSnapshotHash: string;
  status: 'locked' | 'settled';
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

interface RewardSlotSnapshot extends RewardAwardSlot {
  catalogSlotPosition: number;
  slotPosition: number;
}

interface PublicIdentitySnapshot {
  alias: string;
  position: number;
  streaks: {
    daily: number;
    monthly: number;
    projectionVersion: 'streaks-v1';
    weekly: number;
    yearly: number;
  };
  userId: string;
}

@Injectable()
export class DrawsService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly rewards: RewardsService,
    private readonly scoring: CompetitionScoringService,
  ) {}

  async lock(
    transaction: Transaction<Database>,
    input: LockDrawInput,
    now = new Date(),
  ): Promise<LockedDrawResult> {
    if (!canonicalDigestPattern.test(input.seedCommitment)) {
      throw new ConflictException({
        code: 'INVALID_DRAW_COMMITMENT',
        message:
          'The draw seed commitment must be a canonical lowercase SHA-256 hexadecimal digest.',
      });
    }

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
      const existingStatus = existing.status;
      if (existingStatus === 'cancelled') {
        throw new ConflictException({
          code: 'DRAW_CANCELLED',
          message: 'The competition draw was cancelled and cannot be reused.',
        });
      }
      if (existing.seed_commitment !== input.seedCommitment) {
        throw new ConflictException({
          code: 'DRAW_ALREADY_LOCKED',
          message:
            'This competition already has a draw locked with a different seed commitment.',
        });
      }
      if (!existing.snapshot_finalized_at) {
        throw new ConflictException({
          code: 'DRAW_SNAPSHOT_NOT_FINALIZED',
          message:
            'The existing draw snapshot is incomplete and requires an audited forward repair.',
        });
      }
      return toLockedDrawResult({ ...existing, status: existingStatus });
    }
    if (
      !canLockCompetitionDraw({
        competitionEndsAt: competition.ends_at,
        competitionStatus: competition.status,
        now,
      })
    ) {
      throw new ConflictException({
        code: 'COMPETITION_NOT_READY_TO_SETTLE',
        message:
          'The draw can lock only after the active competition and its workout completion period have ended.',
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
      now,
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
    if (progress.length !== Number(activeEnrollments.count)) {
      throw new ConflictException({
        code: 'DRAW_ENTRANT_RECONCILIATION_FAILED',
        message:
          'The active entrant count does not match the finalized scoring inputs.',
      });
    }

    const rewardSlots = await this.rewards.listAvailableAwardSlots(
      transaction,
      competition.id,
      now,
      progress.length,
    );
    if (rewardSlots.length === 0) {
      throw new ConflictException({
        code: 'DRAW_REWARD_INVENTORY_REQUIRED',
        message:
          'Publish at least one eligible in-stock reward before locking the draw.',
      });
    }
    const rewardSlotSnapshots = toRewardSlotSnapshots(rewardSlots);
    const publicIdentities = await this.loadPublicIdentitySnapshots(
      transaction,
      progress.map(({ userId }) => userId),
      now,
    );

    const entrantSnapshot = buildEntrantSnapshot(
      progress.map((entry, index) => ({
        entryCount: entry.prizeDrawEntries,
        position: index + 1,
        userId: entry.userId,
      })),
    );
    const scoringSnapshot = buildScoringSnapshot(
      progress.map((entry, index) => ({
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
      })),
    );
    const rewardSnapshot = buildRewardSnapshot(rewardSlotSnapshots);
    const publicResultSnapshot = buildPublicResultSnapshot(publicIdentities);
    const totalEntries = progress.reduce(
      (total, entry) => total + BigInt(entry.prizeDrawEntries),
      0n,
    );
    const draw = await transaction
      .insertInto('competition_draws')
      .values({
        competition_id: competition.id,
        entrant_count: progress.length,
        entrant_snapshot_hash: hashSnapshot(entrantSnapshot),
        locked_at: now,
        public_result_snapshot_hash: hashSnapshot(publicResultSnapshot),
        reward_slot_count: rewardSlotSnapshots.length,
        reward_snapshot_hash: hashSnapshot(rewardSnapshot),
        rules_version: competition.rules_version,
        scoring_snapshot_hash: hashSnapshot(scoringSnapshot),
        seed_commitment: input.seedCommitment,
        snapshot_finalized_at: null,
        status: 'locked',
        total_entries: totalEntries,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await insertBatches(
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
      (batch) =>
        transaction
          .insertInto('competition_settlement_inputs')
          .values(batch)
          .execute(),
    );
    await insertBatches(
      progress.map((entry, index) => ({
        created_at: now,
        draw_id: draw.id,
        enrollment_id: entry.enrollmentId,
        entry_count: entry.prizeDrawEntries,
        snapshot_position: index + 1,
        user_id: entry.userId,
      })),
      (batch) => transaction.insertInto('draw_entries').values(batch).execute(),
    );
    await insertBatches(
      rewardCatalogSnapshots(draw.id, rewardSlotSnapshots, now),
      (batch) =>
        transaction
          .insertInto('draw_reward_catalog_snapshots')
          .values(batch)
          .execute(),
    );
    await insertBatches(
      rewardSlotSnapshots.map((slot) => ({
        catalog_slot_position: slot.catalogSlotPosition,
        created_at: now,
        draw_id: draw.id,
        reward_catalog_item_id: slot.rewardCatalogItemId,
        slot_position: slot.slotPosition,
      })),
      (batch) =>
        transaction.insertInto('draw_reward_slots').values(batch).execute(),
    );
    await insertBatches(
      publicIdentities.map((identity) => ({
        alias: identity.alias,
        created_at: now,
        draw_id: draw.id,
        streak_daily: identity.streaks.daily,
        streak_monthly: identity.streaks.monthly,
        streak_projection_version: identity.streaks.projectionVersion,
        streak_weekly: identity.streaks.weekly,
        streak_yearly: identity.streaks.yearly,
        user_id: identity.userId,
      })),
      (batch) =>
        transaction
          .insertInto('draw_public_identities')
          .values(batch)
          .execute(),
    );
    await transaction
      .updateTable('competition_draws')
      .set({ snapshot_finalized_at: now })
      .where('id', '=', draw.id)
      .where('status', '=', 'locked')
      .where('snapshot_finalized_at', 'is', null)
      .executeTakeFirstOrThrow();
    await transaction
      .updateTable('competitions')
      .set({ status: 'settling', updated_at: now })
      .where('id', '=', competition.id)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    await this.appendAudit(transaction, {
      action: 'draw.locked',
      actorUserId: input.operatorUserId,
      entityId: draw.id,
      nextState: {
        entrantCount: progress.length,
        entrantSnapshotHash: hashSnapshot(entrantSnapshot),
        progressRowsReconciled: finalizedScoring.reconciledProgressRows,
        publicResultSnapshotHash: hashSnapshot(publicResultSnapshot),
        rewardSlotCount: rewardSlotSnapshots.length,
        rewardSnapshotHash: hashSnapshot(rewardSnapshot),
        scoringSnapshotHash: hashSnapshot(scoringSnapshot),
        status: 'locked',
        totalEntries: totalEntries.toString(),
      },
      previousState: null,
      reason: input.reason,
      requestId: input.requestId,
    });

    return {
      drawId: draw.id,
      entrantCount: progress.length,
      entrantSnapshotHash: hashSnapshot(entrantSnapshot),
      lockedAt: now.toISOString(),
      publicResultSnapshotHash: hashSnapshot(publicResultSnapshot),
      rewardSlotCount: rewardSlotSnapshots.length,
      rewardSnapshotHash: hashSnapshot(rewardSnapshot),
      scoringSnapshotHash: hashSnapshot(scoringSnapshot),
      status: 'locked',
      totalEntries: totalEntries.toString(),
    };
  }

  async settle(
    transaction: Transaction<Database>,
    input: SettleDrawInput,
    now = new Date(),
  ): Promise<SettledDrawResult> {
    if (!canonicalDigestPattern.test(input.seedReveal)) {
      throw new ConflictException({
        code: 'INVALID_DRAW_SEED_REVEAL',
        message:
          'The draw seed reveal must be exactly 32 bytes of lowercase hexadecimal.',
      });
    }
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
        'draw.entrant_count',
        'draw.entrant_snapshot_hash',
        'draw.id',
        'draw.public_result_snapshot_hash',
        'draw.reward_slot_count',
        'draw.reward_snapshot_hash',
        'draw.scoring_snapshot_hash',
        'draw.seed_commitment',
        'draw.seed_reveal',
        'draw.snapshot_finalized_at',
        'draw.status',
        'draw.total_entries',
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
      if (draw.seed_reveal !== input.seedReveal) {
        throw new ConflictException({
          code: 'DRAW_ALREADY_SETTLED',
          message:
            'This draw was already settled with a different seed reveal.',
        });
      }
      const count = await transaction
        .selectFrom('reward_awards')
        .select((expression) => expression.fn.countAll<number>().as('count'))
        .where('draw_id', '=', draw.id)
        .executeTakeFirstOrThrow();
      return { drawId: draw.id, winnerCount: Number(count.count) };
    }
    if (
      draw.status !== 'locked' ||
      draw.competition_status !== 'settling' ||
      !draw.snapshot_finalized_at
    ) {
      throw new ConflictException({
        code: 'DRAW_NOT_SETTLEABLE',
        message:
          'Only a finalized locked draw for a settling competition can be settled.',
      });
    }
    if (buildSeedCommitment(input.seedReveal) !== draw.seed_commitment) {
      throw new ConflictException({
        code: 'DRAW_SEED_COMMITMENT_MISMATCH',
        message: 'The revealed draw seed does not match the locked commitment.',
      });
    }

    const [entries, scoringInputs, rewardSlots, publicIdentities] =
      await Promise.all([
        transaction
          .selectFrom('draw_entries')
          .select(['entry_count', 'snapshot_position', 'user_id'])
          .where('draw_id', '=', draw.id)
          .orderBy('snapshot_position')
          .execute(),
        transaction
          .selectFrom('competition_settlement_inputs')
          .select([
            'category_rank',
            'category_score',
            'enrollment_id',
            'goal_days',
            'longest_streak',
            'prize_draw_entries',
            'rules_version',
            'snapshot_position',
            'tie_break_digest',
            'user_id',
            'verified_days',
          ])
          .where('draw_id', '=', draw.id)
          .orderBy('snapshot_position')
          .execute(),
        transaction
          .selectFrom('draw_reward_slots as slot')
          .innerJoin('draw_reward_catalog_snapshots as reward', (join) =>
            join
              .onRef('reward.draw_id', '=', 'slot.draw_id')
              .onRef(
                'reward.reward_catalog_item_id',
                '=',
                'slot.reward_catalog_item_id',
              ),
          )
          .select([
            'reward.available_from',
            'reward.available_until',
            'reward.catalog_version',
            'reward.cash_amount_cents',
            'reward.cash_currency',
            'slot.catalog_slot_position',
            'reward.display_order',
            'reward.inventory_total',
            'slot.reward_catalog_item_id',
            'reward.reward_type',
            'slot.slot_position',
            'reward.sponsor_name',
            'reward.title',
          ])
          .where('slot.draw_id', '=', draw.id)
          .orderBy('slot.slot_position')
          .execute(),
        transaction
          .selectFrom('draw_public_identities as identity')
          .innerJoin('draw_entries as entry', (join) =>
            join
              .onRef('entry.draw_id', '=', 'identity.draw_id')
              .onRef('entry.user_id', '=', 'identity.user_id'),
          )
          .select([
            'identity.alias',
            'entry.snapshot_position',
            'identity.streak_daily',
            'identity.streak_monthly',
            'identity.streak_projection_version',
            'identity.streak_weekly',
            'identity.streak_yearly',
            'identity.user_id',
          ])
          .where('identity.draw_id', '=', draw.id)
          .orderBy('entry.snapshot_position')
          .execute(),
      ]);

    const normalizedRewardSlots: RewardSlotSnapshot[] = rewardSlots.map(
      (slot) => ({
        availableFrom: slot.available_from,
        availableUntil: slot.available_until,
        catalogSlotPosition: slot.catalog_slot_position,
        catalogVersion: slot.catalog_version,
        cashAmountCents: slot.cash_amount_cents,
        cashCurrency: slot.cash_currency,
        displayOrder: slot.display_order,
        inventoryTotal: slot.inventory_total,
        rewardCatalogItemId: slot.reward_catalog_item_id,
        rewardType: slot.reward_type,
        slotPosition: slot.slot_position,
        sponsorName: slot.sponsor_name,
        title: slot.title,
      }),
    );
    const normalizedPublicIdentities: PublicIdentitySnapshot[] =
      publicIdentities.map((identity) => ({
        alias: identity.alias,
        position: identity.snapshot_position,
        streaks: {
          daily: identity.streak_daily,
          monthly: identity.streak_monthly,
          projectionVersion: identity.streak_projection_version,
          weekly: identity.streak_weekly,
          yearly: identity.streak_yearly,
        },
        userId: identity.user_id,
      }));
    this.assertSnapshotIntegrity(draw, {
      entries,
      publicIdentities: normalizedPublicIdentities,
      rewardSlots: normalizedRewardSlots,
      scoringInputs,
    });

    const winners = selectWeightedWinners(
      entries.map((entry) => ({
        entryCount: entry.entry_count,
        userId: entry.user_id,
      })),
      normalizedRewardSlots.length,
      input.seedReveal,
    );
    const awards: { id: string; user_id: string }[] = [];
    await insertBatches(
      winners.map((winner, index) => ({
        award_rank: index + 1,
        awarded_at: now,
        cancelled_at: null,
        claimed_at: null,
        draw_id: draw.id,
        fulfilled_at: null,
        redeemed_at: null,
        reward_catalog_item_id:
          normalizedRewardSlots[index].rewardCatalogItemId,
        status: 'awarded' as const,
        updated_at: now,
        user_id: winner.userId,
      })),
      async (batch) => {
        const inserted = await transaction
          .insertInto('reward_awards')
          .values(batch)
          .returning(['id', 'user_id'])
          .execute();
        awards.push(...inserted);
      },
    );
    for (const award of awards) {
      await this.notifications.enqueue(
        transaction,
        award.user_id,
        'reward_awarded',
        {
          awardId: award.id,
        },
      );
    }
    await transaction
      .updateTable('competition_draws')
      .set({
        seed_reveal: input.seedReveal,
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
      nextState: {
        rewardSnapshotHash: draw.reward_snapshot_hash,
        status: 'settled',
        winnerCount: winners.length,
      },
      previousState: { status: 'locked' },
      reason: input.reason,
      requestId: input.requestId,
    });

    return { drawId: draw.id, winnerCount: winners.length };
  }

  private async loadPublicIdentitySnapshots(
    transaction: Transaction<Database>,
    userIds: readonly string[],
    now: Date,
  ): Promise<PublicIdentitySnapshot[]> {
    const profiles = await transaction
      .selectFrom('profiles')
      .select(['callsign', 'public_identity_mode', 'public_name', 'user_id'])
      .where('user_id', 'in', userIds)
      .execute();
    if (profiles.length !== userIds.length) {
      throw new ConflictException({
        code: 'DRAW_PUBLIC_IDENTITY_MISSING',
        message:
          'Every entrant requires one privacy-limited public result identity.',
      });
    }
    const profileByUser = new Map(
      profiles.map((profile) => [profile.user_id, profile]),
    );
    const streaksByUser = await loadPublicStreaks(transaction, userIds, now);
    return userIds.map((userId, index) => {
      const profile = profileByUser.get(userId);
      if (!profile) {
        throw new ConflictException({
          code: 'DRAW_PUBLIC_IDENTITY_MISSING',
          message:
            'Every entrant requires one privacy-limited public result identity.',
        });
      }
      return {
        alias:
          profile.public_identity_mode === 'private'
            ? profile.callsign
            : (profile.public_name ?? profile.callsign),
        position: index + 1,
        streaks: streaksByUser.get(userId) ?? {
          daily: 0,
          monthly: 0,
          projectionVersion: 'streaks-v1',
          weekly: 0,
          yearly: 0,
        },
        userId,
      };
    });
  }

  private assertSnapshotIntegrity(
    draw: {
      entrant_count: number;
      entrant_snapshot_hash: string;
      public_result_snapshot_hash: string;
      reward_slot_count: number;
      reward_snapshot_hash: string;
      scoring_snapshot_hash: string;
      total_entries: string;
    },
    snapshot: {
      entries: {
        entry_count: number;
        snapshot_position: number;
        user_id: string;
      }[];
      publicIdentities: PublicIdentitySnapshot[];
      rewardSlots: RewardSlotSnapshot[];
      scoringInputs: {
        category_rank: number;
        category_score: number;
        enrollment_id: string;
        goal_days: number;
        longest_streak: number;
        prize_draw_entries: number;
        rules_version: string;
        snapshot_position: number;
        tie_break_digest: string;
        user_id: string;
        verified_days: number;
      }[];
    },
  ): void {
    const totalEntries = snapshot.entries.reduce(
      (total, entry) => total + BigInt(entry.entry_count),
      0n,
    );
    const valid =
      snapshot.entries.length === draw.entrant_count &&
      snapshot.scoringInputs.length === draw.entrant_count &&
      snapshot.publicIdentities.length === draw.entrant_count &&
      snapshot.rewardSlots.length === draw.reward_slot_count &&
      totalEntries.toString() === String(draw.total_entries) &&
      hashSnapshot(
        buildEntrantSnapshot(
          snapshot.entries.map((entry) => ({
            entryCount: entry.entry_count,
            position: entry.snapshot_position,
            userId: entry.user_id,
          })),
        ),
      ) === draw.entrant_snapshot_hash &&
      hashSnapshot(
        buildScoringSnapshot(
          snapshot.scoringInputs.map((input) => ({
            categoryRank: input.category_rank,
            categoryScore: input.category_score,
            enrollmentId: input.enrollment_id,
            goalDays: input.goal_days,
            longestStreak: input.longest_streak,
            position: input.snapshot_position,
            prizeDrawEntries: input.prize_draw_entries,
            rulesVersion: input.rules_version,
            tieBreakDigest: input.tie_break_digest,
            userId: input.user_id,
            verifiedDays: input.verified_days,
          })),
        ),
      ) === draw.scoring_snapshot_hash &&
      hashSnapshot(buildRewardSnapshot(snapshot.rewardSlots)) ===
        draw.reward_snapshot_hash &&
      hashSnapshot(buildPublicResultSnapshot(snapshot.publicIdentities)) ===
        draw.public_result_snapshot_hash;
    if (!valid) {
      throw new ConflictException({
        code: 'DRAW_SNAPSHOT_INTEGRITY_MISMATCH',
        message:
          'The immutable draw snapshot does not match its recorded counts and hashes.',
      });
    }
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
        reason: event.reason.trim(),
        request_id: event.requestId,
      })
      .executeTakeFirstOrThrow();
  }
}

function toLockedDrawResult(draw: {
  entrant_count: number;
  entrant_snapshot_hash: string;
  id: string;
  locked_at: Date;
  public_result_snapshot_hash: string;
  reward_slot_count: number;
  reward_snapshot_hash: string;
  scoring_snapshot_hash: string;
  status: 'locked' | 'settled';
  total_entries: string;
}): LockedDrawResult {
  return {
    drawId: draw.id,
    entrantCount: draw.entrant_count,
    entrantSnapshotHash: draw.entrant_snapshot_hash,
    lockedAt: draw.locked_at.toISOString(),
    publicResultSnapshotHash: draw.public_result_snapshot_hash,
    rewardSlotCount: draw.reward_slot_count,
    rewardSnapshotHash: draw.reward_snapshot_hash,
    scoringSnapshotHash: draw.scoring_snapshot_hash,
    status: draw.status,
    totalEntries: String(draw.total_entries),
  };
}

function toRewardSlotSnapshots(
  slots: readonly RewardAwardSlot[],
): RewardSlotSnapshot[] {
  const counts = new Map<string, number>();
  return slots.map((slot, index) => {
    const catalogSlotPosition = (counts.get(slot.rewardCatalogItemId) ?? 0) + 1;
    counts.set(slot.rewardCatalogItemId, catalogSlotPosition);
    return { ...slot, catalogSlotPosition, slotPosition: index + 1 };
  });
}

function rewardCatalogSnapshots(
  drawId: string,
  slots: readonly RewardSlotSnapshot[],
  now: Date,
) {
  const byReward = new Map<
    string,
    RewardSlotSnapshot & { availableSlotCount: number }
  >();
  for (const slot of slots) {
    const existing = byReward.get(slot.rewardCatalogItemId);
    byReward.set(slot.rewardCatalogItemId, {
      ...slot,
      availableSlotCount: (existing?.availableSlotCount ?? 0) + 1,
    });
  }
  return [...byReward.values()].map((snapshot) => ({
    available_from: snapshot.availableFrom,
    available_slot_count: snapshot.availableSlotCount,
    available_until: snapshot.availableUntil,
    catalog_version: snapshot.catalogVersion,
    cash_amount_cents: snapshot.cashAmountCents,
    cash_currency: snapshot.cashCurrency,
    created_at: now,
    display_order: snapshot.displayOrder,
    draw_id: drawId,
    inventory_total: snapshot.inventoryTotal,
    reward_catalog_item_id: snapshot.rewardCatalogItemId,
    reward_type: snapshot.rewardType,
    sponsor_name: snapshot.sponsorName,
    title: snapshot.title,
  }));
}

function buildEntrantSnapshot(
  entries: readonly { entryCount: number; position: number; userId: string }[],
): JsonArray {
  return entries.map((entry) => ({ ...entry }));
}

function buildScoringSnapshot(
  entries: readonly {
    categoryRank: number;
    categoryScore: number;
    enrollmentId: string;
    goalDays: number;
    longestStreak: number;
    position: number;
    prizeDrawEntries: number;
    rulesVersion: string;
    tieBreakDigest: string;
    userId: string;
    verifiedDays: number;
  }[],
): JsonArray {
  return entries.map((entry) => ({ ...entry }));
}

function buildRewardSnapshot(slots: readonly RewardSlotSnapshot[]): JsonArray {
  return slots.map((slot) => ({
    availableFrom: slot.availableFrom?.toISOString() ?? null,
    availableUntil: slot.availableUntil?.toISOString() ?? null,
    catalogSlotPosition: slot.catalogSlotPosition,
    catalogVersion: slot.catalogVersion,
    cashAmountCents: slot.cashAmountCents,
    cashCurrency: slot.cashCurrency,
    displayOrder: slot.displayOrder,
    inventoryTotal: slot.inventoryTotal,
    rewardCatalogItemId: slot.rewardCatalogItemId,
    rewardType: slot.rewardType,
    slotPosition: slot.slotPosition,
    sponsorName: slot.sponsorName,
    title: slot.title,
  }));
}

function buildPublicResultSnapshot(
  identities: readonly PublicIdentitySnapshot[],
): JsonArray {
  return identities.map((identity) => ({
    alias: identity.alias,
    position: identity.position,
    streaks: identity.streaks,
    userId: identity.userId,
  }));
}

function hashSnapshot(snapshot: JsonArray): string {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

async function insertBatches<Row>(
  rows: readonly Row[],
  insert: (batch: Row[]) => Promise<unknown>,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += drawInsertBatchSize) {
    await insert(rows.slice(offset, offset + drawInsertBatchSize));
  }
}
