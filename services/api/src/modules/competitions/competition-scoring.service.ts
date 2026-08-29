import { ConflictException, Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type {
  Database,
  JsonObject,
  JsonValue,
} from '../../database/database.types';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  applyCategoryMultiplier,
  calculateWeeklyScore,
  competitionTieBreakDigest,
  longestConsecutiveDateStreak,
  rankCategoryStandings,
} from './competition-scoring';
import {
  buildCompetitionPeriods,
  competitionMonthEndDateKey,
  dateKeyInTimezone,
  type CompetitionPeriod,
} from './competition-calendar';
import {
  parseCompetitionRules,
  type CompetitionRules,
} from './competition-rules';

interface ScoringCompetition {
  id: string;
  monthKey: string;
  rules: CompetitionRules;
  rulesVersion: string;
  timezone: string;
}

interface ScoringEnrollment {
  enrolledAt: Date;
  goalDays: number;
  id: string;
  userId: string;
}

interface ScoringMatch {
  id: string;
  status: 'cancelled' | 'matched' | 'searching' | 'settled';
  userAId: string;
  userBId: string | null;
}

interface UserWeeklyOutcome {
  entries: number;
  goalMet: boolean;
  multiplier: number;
  recovered: boolean;
  userId: string;
  verifiedDays: number;
}

export interface CompetitionSettlementInput {
  categoryRank: number;
  categoryScore: number;
  enrollmentId: string;
  goalDays: number;
  longestStreak: number;
  prizeDrawEntries: number;
  rulesVersion: string;
  tieBreakDigest: string;
  userId: string;
  verifiedDays: number;
}

export interface FinalizedCompetitionScoring {
  reconciledProgressRows: number;
  settlementInputs: CompetitionSettlementInput[];
}

@Injectable()
export class CompetitionScoringService {
  constructor(
    private readonly database: DatabaseService,
    private readonly ledger: LedgerService,
  ) {}

  async processDuePeriods(settlementLimit = 20): Promise<number> {
    if (settlementLimit <= 0) {
      return 0;
    }
    const now = new Date();
    const competitions = await this.database.connection
      .selectFrom('competitions as competition')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'competition.region_policy_id',
      )
      .select([
        'competition.id',
        'competition.month_key',
        'competition.rules',
        'competition.rules_version',
        'region.timezone',
      ])
      .where('competition.status', '=', 'active')
      .orderBy('competition.starts_at')
      .execute();
    let settled = 0;

    for (const row of competitions) {
      const competition = toScoringCompetition(row);
      const periods = buildCompetitionPeriods(competition.monthKey);
      const regionalDateKey = dateKeyInTimezone(now, competition.timezone);
      for (const period of periods) {
        if (settled >= settlementLimit) {
          return settled;
        }
        if (regionalDateKey <= period.endDateKey) {
          continue;
        }
        const periodSettled = await this.database.connection
          .transaction()
          .execute(async (transaction) => {
            const locked = await transaction
              .selectFrom('competitions')
              .select('status')
              .where('id', '=', competition.id)
              .forUpdate()
              .executeTakeFirst();
            if (!locked || locked.status !== 'active') {
              return false;
            }
            return this.settlePeriod(
              transaction,
              competition,
              period,
              now,
              true,
            );
          });
        if (periodSettled) {
          settled += 1;
        }
      }
    }

    return settled;
  }

  async finalizeForDraw(
    transaction: Transaction<Database>,
    competitionId: string,
    now: Date,
  ): Promise<FinalizedCompetitionScoring> {
    const row = await transaction
      .selectFrom('competitions as competition')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'competition.region_policy_id',
      )
      .select([
        'competition.id',
        'competition.month_key',
        'competition.rules',
        'competition.rules_version',
        'region.timezone',
      ])
      .where('competition.id', '=', competitionId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const competition = toScoringCompetition(row);

    for (const period of buildCompetitionPeriods(competition.monthKey)) {
      await this.settlePeriod(transaction, competition, period, now, false);
    }
    const reconciledProgressRows = await this.reconcileProgressFromLedger(
      transaction,
      competition,
      now,
    );
    await this.applyFinalAdjustments(transaction, competition);
    return {
      reconciledProgressRows,
      settlementInputs: await this.buildSettlementInputs(
        transaction,
        competition,
      ),
    };
  }

  private async prepareWeeklyChallengeSettlementRows(
    transaction: Transaction<Database>,
    competitionId: string,
    period: CompetitionPeriod,
    now: Date,
  ): Promise<number> {
    const enrollments = await this.loadEnrollments(transaction, competitionId);
    const enrollmentByUserId = new Map(
      enrollments.map((enrollment) => [enrollment.userId, enrollment]),
    );
    const existingMatches = await transaction
      .selectFrom('competition_matches')
      .select([
        'id',
        'status',
        'user_a_id',
        'user_b_id',
        'weekly_challenge_request_id',
      ])
      .where('competition_id', '=', competitionId)
      .where('period_index', '=', period.index)
      .where('status', '!=', 'cancelled')
      .orderBy('id')
      .execute();
    const validMatches: typeof existingMatches = [];
    let changes = 0;

    for (const match of existingMatches) {
      if (match.status !== 'matched' || !match.user_b_id) {
        validMatches.push(match);
        continue;
      }
      const [userAId, userBId] = [match.user_a_id, match.user_b_id].sort();
      const [request, friendship, block] = await Promise.all([
        match.weekly_challenge_request_id
          ? transaction
              .selectFrom('weekly_challenge_requests')
              .select(['goal_days', 'id'])
              .where('id', '=', match.weekly_challenge_request_id)
              .where('competition_id', '=', competitionId)
              .where('period_index', '=', period.index)
              .where('status', '=', 'accepted')
              .executeTakeFirst()
          : Promise.resolve(undefined),
        match.weekly_challenge_request_id
          ? transaction
              .selectFrom('friendships')
              .select('created_at')
              .where('user_a_id', '=', userAId)
              .where('user_b_id', '=', userBId)
              .executeTakeFirst()
          : Promise.resolve(undefined),
        transaction
          .selectFrom('user_blocks')
          .select('id')
          .where((expression) =>
            expression.or([
              expression.and([
                expression('blocker_user_id', '=', userAId),
                expression('blocked_user_id', '=', userBId),
              ]),
              expression.and([
                expression('blocker_user_id', '=', userBId),
                expression('blocked_user_id', '=', userAId),
              ]),
            ]),
          )
          .executeTakeFirst(),
      ]);
      const userA = enrollmentByUserId.get(match.user_a_id);
      const userB = enrollmentByUserId.get(match.user_b_id);
      const sharedEligibility = Boolean(
        !block && userA && userB && userA.goalDays === userB.goalDays,
      );
      const matchIsEligible = match.weekly_challenge_request_id
        ? Boolean(
            sharedEligibility &&
            request &&
            friendship &&
            userA?.goalDays === request.goal_days,
          )
        : sharedEligibility;

      if (matchIsEligible) {
        validMatches.push(match);
        continue;
      }
      if (match.weekly_challenge_request_id) {
        await transaction
          .updateTable('weekly_challenge_requests')
          .set({
            cancellation_reason: 'period_eligibility_lost',
            responded_at: now,
            status: 'cancelled',
          })
          .where('id', '=', match.weekly_challenge_request_id)
          .where('status', '=', 'accepted')
          .execute();
      }
      await transaction
        .updateTable('competition_matches')
        .set({
          outcome: { reason: 'direct_partner_eligibility_lost' },
          settled_at: now,
          status: 'cancelled',
        })
        .where('id', '=', match.id)
        .where('status', '=', 'matched')
        .executeTakeFirstOrThrow();
      changes += 1;
    }

    const assignedUserIds = new Set<string>();
    for (const match of validMatches) {
      assignedUserIds.add(match.user_a_id);
      if (match.user_b_id) assignedUserIds.add(match.user_b_id);
    }
    for (const enrollment of enrollments) {
      if (assignedUserIds.has(enrollment.userId)) continue;
      await transaction
        .insertInto('competition_matches')
        .values({
          competition_id: competitionId,
          created_at: now,
          outcome: null,
          period_end_date: period.endDateKey,
          period_index: period.index,
          period_start_date: period.startDateKey,
          settled_at: null,
          status: 'searching',
          user_a_id: enrollment.userId,
          user_b_id: null,
          weekly_challenge_request_id: null,
        })
        .executeTakeFirstOrThrow();
      changes += 1;
    }

    await transaction
      .updateTable('weekly_challenge_requests')
      .set({
        cancellation_reason: 'period_closed',
        responded_at: now,
        status: 'cancelled',
      })
      .where('competition_id', '=', competitionId)
      .where('period_index', '=', period.index)
      .where('status', '=', 'pending')
      .execute();
    return changes;
  }

  private async settlePeriod(
    transaction: Transaction<Database>,
    competition: ScoringCompetition,
    period: CompetitionPeriod,
    now: Date,
    waitForResolvedSessions: boolean,
  ): Promise<boolean> {
    if (
      waitForResolvedSessions &&
      (await this.hasUnresolvedSessions(transaction, competition.id, period))
    ) {
      return false;
    }

    await this.prepareWeeklyChallengeSettlementRows(
      transaction,
      competition.id,
      period,
      now,
    );

    const enrollments = await this.loadEnrollments(transaction, competition.id);
    if (enrollments.length === 0) {
      return false;
    }
    const enrollmentByUser = new Map(
      enrollments.map((enrollment) => [enrollment.userId, enrollment]),
    );
    const verifiedDaysByUser = await this.loadVerifiedDateKeys(
      transaction,
      competition.id,
      period.startDateKey,
      period.endDateKey,
    );
    const matchRows = await transaction
      .selectFrom('competition_matches')
      .select(['id', 'status', 'user_a_id', 'user_b_id'])
      .where('competition_id', '=', competition.id)
      .where('period_index', '=', period.index)
      .where('status', '!=', 'cancelled')
      .orderBy('id')
      .execute();
    const matches: ScoringMatch[] = matchRows.map((match) => ({
      id: match.id,
      status: match.status,
      userAId: match.user_a_id,
      userBId: match.user_b_id,
    }));
    const assignedUsers = new Set<string>();
    let changed = false;

    for (const match of matches) {
      if (match.status === 'settled') {
        assignedUsers.add(match.userAId);
        if (match.userBId) {
          assignedUsers.add(match.userBId);
        }
        continue;
      }

      const userA = enrollmentByUser.get(match.userAId);
      const userB =
        match.status === 'matched' && match.userBId
          ? enrollmentByUser.get(match.userBId)
          : undefined;
      if (!userA) {
        continue;
      }
      assignedUsers.add(userA.userId);
      if (userB) {
        assignedUsers.add(userB.userId);
      }

      await this.scoreAndSettleMatch(
        transaction,
        competition,
        period,
        match,
        userA,
        userB ?? null,
        verifiedDaysByUser,
        now,
      );
      changed = true;
    }

    for (const enrollment of enrollments) {
      if (assignedUsers.has(enrollment.userId)) {
        continue;
      }
      const match = await transaction
        .insertInto('competition_matches')
        .values({
          competition_id: competition.id,
          created_at: now,
          outcome: null,
          period_end_date: period.endDateKey,
          period_index: period.index,
          period_start_date: period.startDateKey,
          settled_at: null,
          status: 'searching',
          user_a_id: enrollment.userId,
          user_b_id: null,
          weekly_challenge_request_id: null,
        })
        .returning(['id', 'status', 'user_a_id', 'user_b_id'])
        .executeTakeFirstOrThrow();
      await this.scoreAndSettleMatch(
        transaction,
        competition,
        period,
        {
          id: match.id,
          status: match.status,
          userAId: match.user_a_id,
          userBId: match.user_b_id,
        },
        enrollment,
        null,
        verifiedDaysByUser,
        now,
      );
      changed = true;
    }

    return changed;
  }

  private async scoreAndSettleMatch(
    transaction: Transaction<Database>,
    competition: ScoringCompetition,
    period: CompetitionPeriod,
    match: ScoringMatch,
    userA: ScoringEnrollment,
    userB: ScoringEnrollment | null,
    verifiedDaysByUser: ReadonlyMap<string, readonly string[]>,
    now: Date,
  ): Promise<void> {
    const userAVerifiedDays = verifiedDaysByUser.get(userA.userId)?.length ?? 0;
    const userBVerifiedDays = userB
      ? (verifiedDaysByUser.get(userB.userId)?.length ?? 0)
      : null;
    const userAOutcome = this.calculateUserWeeklyOutcome(
      competition,
      userA,
      userAVerifiedDays,
      userBVerifiedDays,
    );
    const outcomes = [userAOutcome];
    if (userB && userBVerifiedDays !== null) {
      outcomes.push(
        this.calculateUserWeeklyOutcome(
          competition,
          userB,
          userBVerifiedDays,
          userAVerifiedDays,
        ),
      );
    }

    for (const outcome of outcomes) {
      const enrollment =
        outcome.userId === userA.userId ? userA : (userB as ScoringEnrollment);
      const provisionalValue = await this.loadPeriodVerifiedSessionValue(
        transaction,
        competition.id,
        outcome.userId,
        period.startDateKey,
        period.endDateKey,
      );
      const categoryScoreAdjustment =
        outcome.entries - provisionalValue.categoryScore;
      const prizeDrawEntriesAdjustment =
        outcome.entries - provisionalValue.prizeDrawEntries;
      if (categoryScoreAdjustment !== 0 || prizeDrawEntriesAdjustment !== 0) {
        await this.ledger.append(transaction, {
          categoryScoreDelta: categoryScoreAdjustment,
          competitionId: competition.id,
          enrollmentId: enrollment.id,
          goalDays: enrollment.goalDays,
          metadata: {
            entriesAfterSettlement: outcome.entries,
            multiplier: outcome.multiplier,
            periodIndex: period.index,
            provisionalCategoryScore: provisionalValue.categoryScore,
            provisionalPrizeDrawEntries: provisionalValue.prizeDrawEntries,
            recovered: outcome.recovered,
            verifiedDays: outcome.verifiedDays,
          },
          policyVersion: competition.rulesVersion,
          prizeDrawEntriesDelta: prizeDrawEntriesAdjustment,
          reason: 'weekly_match',
          sourceEventId: match.id,
          userId: enrollment.userId,
          verifiedDaysDelta: 0,
        });
      }
    }

    await transaction
      .updateTable('competition_matches')
      .set({
        outcome: {
          periodIndex: period.index,
          results: outcomes.map(toJsonOutcome),
          type: userB ? 'matched' : 'solo',
        },
        settled_at: now,
        status: 'settled',
      })
      .where('id', '=', match.id)
      .where('status', '!=', 'settled')
      .executeTakeFirstOrThrow();
  }

  private calculateUserWeeklyOutcome(
    competition: ScoringCompetition,
    enrollment: ScoringEnrollment,
    verifiedDays: number,
    opponentVerifiedDays: number | null,
  ): UserWeeklyOutcome {
    const score = calculateWeeklyScore({
      bothHitMultiplier: competition.rules.weeklyChallengeBothHitMultiplier,
      entriesPerVerifiedDay: competition.rules.verifiedSessionPrizeDrawEntries,
      goalDays: enrollment.goalDays,
      opponentVerifiedDays,
      recoveryMultiplier: competition.rules.weeklyChallengeRecoveryMultiplier,
      verifiedDays,
    });

    return { ...score, userId: enrollment.userId, verifiedDays };
  }

  private async loadPeriodVerifiedSessionValue(
    transaction: Transaction<Database>,
    competitionId: string,
    userId: string,
    startDateKey: string,
    endDateKey: string,
  ): Promise<{ categoryScore: number; prizeDrawEntries: number }> {
    const row = await transaction
      .selectFrom('entry_ledger as entry')
      .innerJoin(
        'workout_sessions as session',
        'session.id',
        'entry.source_event_id',
      )
      .select((expression) => [
        expression.fn
          .sum<number>('entry.category_score_delta')
          .as('category_score'),
        expression.fn
          .sum<number>('entry.prize_draw_entries_delta')
          .as('prize_draw_entries'),
      ])
      .where('entry.competition_id', '=', competitionId)
      .where('entry.user_id', '=', userId)
      .where('entry.reason', '=', 'verified_session')
      .where('session.eligible_date', '>=', startDateKey)
      .where('session.eligible_date', '<=', endDateKey)
      .executeTakeFirstOrThrow();

    return {
      categoryScore: Number(row.category_score ?? 0),
      prizeDrawEntries: Number(row.prize_draw_entries ?? 0),
    };
  }

  private async reconcileProgressFromLedger(
    transaction: Transaction<Database>,
    competition: ScoringCompetition,
    now: Date,
  ): Promise<number> {
    const enrollments = await this.loadEnrollments(transaction, competition.id);
    const [ledgerRows, progressRows, verifiedDateKeys] = await Promise.all([
      transaction
        .selectFrom('entry_ledger')
        .select((expression) => [
          'enrollment_id',
          'user_id',
          expression.fn
            .sum<number>('category_score_delta')
            .as('category_score'),
          expression.fn
            .sum<number>('prize_draw_entries_delta')
            .as('prize_draw_entries'),
          expression.fn.sum<number>('verified_days_delta').as('verified_days'),
        ])
        .where('competition_id', '=', competition.id)
        .groupBy(['enrollment_id', 'user_id'])
        .execute(),
      transaction
        .selectFrom('competition_progress')
        .select([
          'category_score',
          'enrollment_id',
          'goal_days',
          'prize_draw_entries',
          'user_id',
          'verified_days',
        ])
        .where('competition_id', '=', competition.id)
        .execute(),
      this.loadVerifiedDateKeys(
        transaction,
        competition.id,
        `${competition.monthKey}-01`,
        competitionMonthEndDateKey(competition.monthKey),
      ),
    ]);
    const ledgerByUser = new Map(ledgerRows.map((row) => [row.user_id, row]));
    const progressByUser = new Map(
      progressRows.map((row) => [row.user_id, row]),
    );
    let reconciled = 0;

    for (const enrollment of enrollments) {
      const ledger = ledgerByUser.get(enrollment.userId);
      if (!ledger || ledger.enrollment_id !== enrollment.id) {
        throw scoringIntegrityConflict(
          'SCORING_LEDGER_ENROLLMENT_MISMATCH',
          'The scoring ledger does not match the active Contest enrollment.',
        );
      }
      const totals = {
        categoryScore: Number(ledger.category_score ?? 0),
        prizeDrawEntries: Number(ledger.prize_draw_entries ?? 0),
        verifiedDays: Number(ledger.verified_days ?? 0),
      };
      if (
        totals.categoryScore < 0 ||
        totals.prizeDrawEntries < 0 ||
        totals.verifiedDays < 0 ||
        totals.verifiedDays !==
          (verifiedDateKeys.get(enrollment.userId)?.length ?? 0)
      ) {
        throw scoringIntegrityConflict(
          'SCORING_LEDGER_VERIFIED_DAY_MISMATCH',
          'Verified workout days and the append-only scoring ledger require reconciliation before settlement.',
        );
      }
      const current = progressByUser.get(enrollment.userId);
      if (
        current?.enrollment_id === enrollment.id &&
        current.goal_days === enrollment.goalDays &&
        current.category_score === totals.categoryScore &&
        current.prize_draw_entries === totals.prizeDrawEntries &&
        current.verified_days === totals.verifiedDays
      ) {
        continue;
      }

      await transaction
        .insertInto('competition_progress')
        .values({
          category_score: totals.categoryScore,
          competition_id: competition.id,
          enrollment_id: enrollment.id,
          goal_days: enrollment.goalDays,
          prize_draw_entries: totals.prizeDrawEntries,
          updated_at: now,
          user_id: enrollment.userId,
          verified_days: totals.verifiedDays,
        })
        .onConflict((conflict) =>
          conflict.columns(['competition_id', 'user_id']).doUpdateSet({
            category_score: totals.categoryScore,
            enrollment_id: enrollment.id,
            goal_days: enrollment.goalDays,
            prize_draw_entries: totals.prizeDrawEntries,
            updated_at: now,
            verified_days: totals.verifiedDays,
          }),
        )
        .executeTakeFirstOrThrow();
      reconciled += 1;
    }

    return reconciled;
  }

  private async buildSettlementInputs(
    transaction: Transaction<Database>,
    competition: ScoringCompetition,
  ): Promise<CompetitionSettlementInput[]> {
    const enrollments = await this.loadEnrollments(transaction, competition.id);
    const [progressRows, verifiedDateKeys] = await Promise.all([
      transaction
        .selectFrom('competition_progress')
        .select([
          'category_score',
          'prize_draw_entries',
          'user_id',
          'verified_days',
        ])
        .where('competition_id', '=', competition.id)
        .execute(),
      this.loadVerifiedDateKeys(
        transaction,
        competition.id,
        `${competition.monthKey}-01`,
        competitionMonthEndDateKey(competition.monthKey),
      ),
    ]);
    const progressByUser = new Map(
      progressRows.map((row) => [row.user_id, row]),
    );
    const rankByUser = new Map<string, number>();

    for (const goalDays of new Set(
      enrollments.map((enrollment) => enrollment.goalDays),
    )) {
      const standings = rankCategoryStandings(
        competition.id,
        competition.rulesVersion,
        enrollments
          .filter((enrollment) => enrollment.goalDays === goalDays)
          .map((enrollment) => {
            const progress = progressByUser.get(enrollment.userId);
            const dateKeys = verifiedDateKeys.get(enrollment.userId) ?? [];
            if (!progress || progress.verified_days !== dateKeys.length) {
              throw scoringIntegrityConflict(
                'SCORING_PROGRESS_VERIFIED_DAY_MISMATCH',
                'Contest progress does not match its verified-day evidence.',
              );
            }
            return {
              categoryScore: progress.category_score,
              goalDays,
              longestStreak: longestConsecutiveDateStreak(dateKeys),
              userId: enrollment.userId,
              verifiedDays: progress.verified_days,
            };
          }),
      );
      for (const standing of standings) {
        rankByUser.set(standing.userId, standing.rank);
      }
    }

    return enrollments
      .map((enrollment) => {
        const progress = progressByUser.get(enrollment.userId);
        const categoryRank = rankByUser.get(enrollment.userId);
        const dateKeys = verifiedDateKeys.get(enrollment.userId) ?? [];
        if (!progress || !categoryRank || progress.prize_draw_entries <= 0) {
          throw scoringIntegrityConflict(
            'SCORING_SETTLEMENT_INPUT_MISSING',
            'Every active entrant requires positive, reconciled settlement input.',
          );
        }
        return {
          categoryRank,
          categoryScore: progress.category_score,
          enrollmentId: enrollment.id,
          goalDays: enrollment.goalDays,
          longestStreak: longestConsecutiveDateStreak(dateKeys),
          prizeDrawEntries: progress.prize_draw_entries,
          rulesVersion: competition.rulesVersion,
          tieBreakDigest: competitionTieBreakDigest(
            competition.id,
            competition.rulesVersion,
            enrollment.userId,
          ),
          userId: enrollment.userId,
          verifiedDays: progress.verified_days,
        } satisfies CompetitionSettlementInput;
      })
      .sort((left, right) => left.userId.localeCompare(right.userId));
  }

  private async applyFinalAdjustments(
    transaction: Transaction<Database>,
    competition: ScoringCompetition,
  ): Promise<void> {
    const enrollments = await this.loadEnrollments(transaction, competition.id);
    const progress = await transaction
      .selectFrom('competition_progress')
      .select([
        'category_score',
        'goal_days',
        'prize_draw_entries',
        'user_id',
        'verified_days',
      ])
      .where('competition_id', '=', competition.id)
      .execute();
    const progressByUser = new Map(progress.map((row) => [row.user_id, row]));
    const allVerifiedDays = await this.loadVerifiedDateKeys(
      transaction,
      competition.id,
      `${competition.monthKey}-01`,
      competitionMonthEndDateKey(competition.monthKey),
    );
    const weeklyLedgerRows = await transaction
      .selectFrom('entry_ledger')
      .select(['prize_draw_entries_delta', 'user_id'])
      .where('competition_id', '=', competition.id)
      .where('reason', '=', 'weekly_match')
      .execute();
    const weeklyAdjustments = sumByUser(weeklyLedgerRows);
    const standingsByGoal = new Map<number, Map<string, number>>();

    for (const goalDays of new Set(
      enrollments.map(({ goalDays }) => goalDays),
    )) {
      const standings = rankCategoryStandings(
        competition.id,
        competition.rulesVersion,
        enrollments
          .filter((enrollment) => enrollment.goalDays === goalDays)
          .map((enrollment) => {
            const userProgress = progressByUser.get(enrollment.userId);
            const dateKeys = allVerifiedDays.get(enrollment.userId) ?? [];
            return {
              categoryScore: userProgress?.category_score ?? 0,
              goalDays,
              longestStreak: longestConsecutiveDateStreak(dateKeys),
              userId: enrollment.userId,
              verifiedDays: userProgress?.verified_days ?? 0,
            };
          }),
      );
      standingsByGoal.set(
        goalDays,
        new Map(standings.map(({ rank, userId }) => [userId, rank])),
      );
    }

    for (const enrollment of enrollments) {
      const dateKeys = allVerifiedDays.get(enrollment.userId) ?? [];
      const firstFourWeekDays = dateKeys.filter(
        (dateKey) => Number(dateKey.slice(-2)) <= 28,
      );
      const bonusDays = dateKeys.filter(
        (dateKey) => Number(dateKey.slice(-2)) > 28,
      ).length;
      const weeklyRawEntries =
        firstFourWeekDays.length *
        competition.rules.verifiedSessionPrizeDrawEntries;
      const weeklyEntries =
        weeklyRawEntries + (weeklyAdjustments.get(enrollment.userId) ?? 0);
      const categoryRank =
        standingsByGoal.get(enrollment.goalDays)?.get(enrollment.userId) ??
        null;
      const categoryMultiplier =
        categoryRank && categoryRank <= 3
          ? competition.rules.categoryPodiumMultipliers[
              categoryRank as 1 | 2 | 3
            ]
          : 1;
      const categoryAdjustedEntries = applyCategoryMultiplier(
        weeklyEntries,
        categoryMultiplier,
      );
      const categoryAdjustment = categoryAdjustedEntries - weeklyEntries;
      const bonusEntries = bonusDays * enrollment.goalDays;
      const rawBonusEntries =
        bonusDays * competition.rules.verifiedSessionPrizeDrawEntries;
      const bonusAdjustment = bonusEntries - rawBonusEntries;
      const provisionalBonusValue = await this.loadPeriodVerifiedSessionValue(
        transaction,
        competition.id,
        enrollment.userId,
        `${competition.monthKey}-29`,
        competitionMonthEndDateKey(competition.monthKey),
      );
      const bonusCategoryScoreAdjustment = -provisionalBonusValue.categoryScore;
      const enrollmentDateKey = dateKeyInTimezone(
        enrollment.enrolledAt,
        competition.timezone,
      );
      const eligiblePeriods = buildCompetitionPeriods(
        competition.monthKey,
      ).filter((period) => period.endDateKey >= enrollmentDateKey);
      const perfectMonth =
        eligiblePeriods.length > 0 &&
        eligiblePeriods.every(
          (period) =>
            firstFourWeekDays.filter(
              (dateKey) =>
                dateKey >= period.startDateKey && dateKey <= period.endDateKey,
            ).length >= enrollment.goalDays,
        );
      const perfectMonthBase = categoryAdjustedEntries + bonusEntries;
      const perfectMonthAdjustment = perfectMonth
        ? perfectMonthBase * (competition.rules.perfectMonthMultiplier - 1)
        : 0;
      const common = {
        categoryScoreDelta: 0,
        competitionId: competition.id,
        enrollmentId: enrollment.id,
        goalDays: enrollment.goalDays,
        policyVersion: competition.rulesVersion,
        sourceEventId: enrollment.id,
        userId: enrollment.userId,
        verifiedDaysDelta: 0,
      } as const;

      if (categoryAdjustment !== 0) {
        await this.ledger.append(transaction, {
          ...common,
          metadata: {
            categoryRank,
            entriesAfterMultiplier: categoryAdjustedEntries,
            multiplier: categoryMultiplier,
          },
          prizeDrawEntriesDelta: categoryAdjustment,
          reason: 'category_placement',
        });
      }
      if (bonusAdjustment !== 0 || bonusCategoryScoreAdjustment !== 0) {
        await this.ledger.append(transaction, {
          ...common,
          categoryScoreDelta: bonusCategoryScoreAdjustment,
          metadata: {
            bonusDays,
            entriesAfterSettlement: bonusEntries,
            provisionalCategoryScore: provisionalBonusValue.categoryScore,
          },
          prizeDrawEntriesDelta: bonusAdjustment,
          reason: 'bonus_day',
        });
      }
      if (perfectMonthAdjustment !== 0) {
        await this.ledger.append(transaction, {
          ...common,
          metadata: {
            entriesBeforeMultiplier: perfectMonthBase,
            multiplier: competition.rules.perfectMonthMultiplier,
          },
          prizeDrawEntriesDelta: perfectMonthAdjustment,
          reason: 'perfect_month',
        });
      }
    }
  }

  private async hasUnresolvedSessions(
    transaction: Transaction<Database>,
    competitionId: string,
    period: CompetitionPeriod,
  ): Promise<boolean> {
    const row = await transaction
      .selectFrom('workout_sessions')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('competition_id', '=', competitionId)
      .where('eligible_date', '>=', period.startDateKey)
      .where('eligible_date', '<=', period.endDateKey)
      .where('status', 'in', ['active', 'pending_review'])
      .executeTakeFirstOrThrow();
    return Number(row.count) > 0;
  }

  private loadEnrollments(
    transaction: Transaction<Database>,
    competitionId: string,
  ): Promise<ScoringEnrollment[]> {
    return transaction
      .selectFrom('competition_enrollments as enrollment')
      .innerJoin('users as user', 'user.id', 'enrollment.user_id')
      .select([
        'enrollment.enrolled_at',
        'enrollment.goal_days',
        'enrollment.id',
        'enrollment.user_id',
      ])
      .where('enrollment.competition_id', '=', competitionId)
      .where('enrollment.status', '=', 'active')
      .where('user.email', 'is not', null)
      .where('user.email_verified', '=', true)
      .where('user.status', '=', 'active')
      .execute()
      .then((rows) =>
        rows.map((row) => ({
          enrolledAt: row.enrolled_at,
          goalDays: row.goal_days,
          id: row.id,
          userId: row.user_id,
        })),
      );
  }

  private async loadVerifiedDateKeys(
    transaction: Transaction<Database>,
    competitionId: string,
    startDateKey: string,
    endDateKey: string,
  ): Promise<Map<string, string[]>> {
    const rows = await transaction
      .selectFrom('workout_sessions as session')
      .innerJoin('competition_enrollments as enrollment', (join) =>
        join
          .onRef('enrollment.id', '=', 'session.enrollment_id')
          .onRef('enrollment.competition_id', '=', 'session.competition_id')
          .onRef('enrollment.user_id', '=', 'session.user_id'),
      )
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'session.competition_id',
      )
      .select(['session.eligible_date', 'session.user_id'])
      .distinct()
      .where('session.competition_id', '=', competitionId)
      .where('session.eligible_date', '>=', startDateKey)
      .where('session.eligible_date', '<=', endDateKey)
      .whereRef('session.started_at', '>=', 'enrollment.enrolled_at')
      .whereRef('session.started_at', '>=', 'competition.starts_at')
      .whereRef('session.started_at', '<', 'competition.ends_at')
      .whereRef('session.policy_version', '=', 'competition.rules_version')
      .where(
        sql<boolean>`session.gym_location_id IS NOT DISTINCT FROM enrollment.gym_location_id`,
      )
      .where(
        sql<boolean>`session.gym_credential_version IS NOT DISTINCT FROM enrollment.gym_credential_version`,
      )
      .where('session.status', '=', 'verified')
      .where('enrollment.status', '=', 'active')
      .orderBy('session.eligible_date')
      .execute();
    const byUser = new Map<string, string[]>();

    for (const row of rows) {
      const dateKeys = byUser.get(row.user_id) ?? [];
      dateKeys.push(normalizeDateKey(row.eligible_date));
      byUser.set(row.user_id, dateKeys);
    }

    return byUser;
  }
}

function toScoringCompetition(row: {
  id: string;
  month_key: string;
  rules: JsonValue;
  rules_version: string;
  timezone: string;
}): ScoringCompetition {
  return {
    id: row.id,
    monthKey: row.month_key,
    rules: parseCompetitionRules(row.rules),
    rulesVersion: row.rules_version,
    timezone: row.timezone,
  };
}

function toJsonOutcome(outcome: UserWeeklyOutcome): JsonObject {
  return {
    entries: outcome.entries,
    goalMet: outcome.goalMet,
    multiplier: outcome.multiplier,
    recovered: outcome.recovered,
    userId: outcome.userId,
    verifiedDays: outcome.verifiedDays,
  };
}

function sumByUser(
  rows: readonly {
    prize_draw_entries_delta: number;
    user_id: string;
  }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(
      row.user_id,
      (totals.get(row.user_id) ?? 0) + row.prize_draw_entries_delta,
    );
  }
  return totals;
}

function scoringIntegrityConflict(code: string, message: string) {
  return new ConflictException({ code, message });
}
