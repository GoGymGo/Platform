import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
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
import { buildAutomaticWeeklyChallengePairs } from './weekly-challenge-pairing';

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
      await this.database.connection
        .transaction()
        .execute(async (transaction) => {
          const activeCompetition = await transaction
            .selectFrom('competitions')
            .select('status')
            .where('id', '=', competition.id)
            .forUpdate()
            .executeTakeFirst();
          if (activeCompetition?.status === 'active') {
            await this.ensureWeeklyChallengeMatches(
              transaction,
              competition.id,
              competition.monthKey,
              now,
              periods,
            );
          }
        });
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
  ): Promise<void> {
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
      .executeTakeFirstOrThrow();
    const competition = toScoringCompetition(row);

    for (const period of buildCompetitionPeriods(competition.monthKey)) {
      await this.settlePeriod(transaction, competition, period, now, false);
    }
    await this.applyFinalAdjustments(transaction, competition);
  }

  async ensureWeeklyChallengeMatches(
    transaction: Transaction<Database>,
    competitionId: string,
    monthKey: string,
    now: Date,
    periods: readonly CompetitionPeriod[] = buildCompetitionPeriods(monthKey),
  ): Promise<number> {
    if (periods.length === 0) {
      return 0;
    }

    const enrollments = await this.loadEnrollments(transaction, competitionId);
    if (enrollments.length === 0) {
      return 0;
    }
    const existingMatches = await transaction
      .selectFrom('competition_matches')
      .select(['period_index', 'user_a_id', 'user_b_id'])
      .where('competition_id', '=', competitionId)
      .where(
        'period_index',
        'in',
        periods.map((period) => period.index),
      )
      .execute();
    let created = 0;

    for (const period of periods) {
      const assignedUserIds = new Set<string>();
      for (const match of existingMatches) {
        if (match.period_index !== period.index) {
          continue;
        }
        assignedUserIds.add(match.user_a_id);
        if (match.user_b_id) {
          assignedUserIds.add(match.user_b_id);
        }
      }

      const automaticPairs = buildAutomaticWeeklyChallengePairs(
        enrollments,
        assignedUserIds,
      );
      for (const pair of automaticPairs) {
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
            status: pair.userBId ? 'matched' : 'searching',
            user_a_id: pair.userAId,
            user_b_id: pair.userBId,
          })
          .executeTakeFirstOrThrow();
        created += 1;
      }

      await transaction
        .updateTable('weekly_challenge_requests')
        .set({ responded_at: now, status: 'cancelled' })
        .where('competition_id', '=', competitionId)
        .where('period_index', '=', period.index)
        .where('status', '=', 'pending')
        .execute();
    }

    return created;
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

    await this.ensureWeeklyChallengeMatches(
      transaction,
      competition.id,
      competition.monthKey,
      now,
      [period],
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

    if (changed) {
      await transaction
        .updateTable('weekly_challenge_requests')
        .set({ responded_at: now, status: 'cancelled' })
        .where('competition_id', '=', competition.id)
        .where('period_index', '=', period.index)
        .where('status', '=', 'pending')
        .execute();
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
      period,
      userA,
      userAVerifiedDays,
      userBVerifiedDays,
    );
    const outcomes = [userAOutcome];
    if (userB && userBVerifiedDays !== null) {
      outcomes.push(
        this.calculateUserWeeklyOutcome(
          competition,
          period,
          userB,
          userBVerifiedDays,
          userAVerifiedDays,
        ),
      );
    }

    for (const outcome of outcomes) {
      const enrollment =
        outcome.userId === userA.userId ? userA : (userB as ScoringEnrollment);
      const rawEntries =
        outcome.verifiedDays *
        competition.rules.verifiedSessionPrizeDrawEntries;
      const adjustment = outcome.entries - rawEntries;
      if (adjustment !== 0) {
        await this.ledger.append(transaction, {
          categoryScoreDelta: 0,
          competitionId: competition.id,
          enrollmentId: enrollment.id,
          goalDays: enrollment.goalDays,
          metadata: {
            entriesAfterSettlement: outcome.entries,
            multiplier: outcome.multiplier,
            periodIndex: period.index,
            recovered: outcome.recovered,
            verifiedDays: outcome.verifiedDays,
          },
          policyVersion: competition.rulesVersion,
          prizeDrawEntriesDelta: adjustment,
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
    period: CompetitionPeriod,
    enrollment: ScoringEnrollment,
    verifiedDays: number,
    opponentVerifiedDays: number | null,
  ): UserWeeklyOutcome {
    const enrollmentDateKey = dateKeyInTimezone(
      enrollment.enrolledAt,
      competition.timezone,
    );
    const availableStartDateKey =
      enrollmentDateKey > period.startDateKey
        ? enrollmentDateKey
        : period.startDateKey;
    const availableDays = inclusiveDayCount(
      availableStartDateKey,
      period.endDateKey,
    );
    const score = calculateWeeklyScore({
      availableDays,
      bothHitMultiplier: competition.rules.weeklyChallengeBothHitMultiplier,
      entriesPerVerifiedDay: competition.rules.verifiedSessionPrizeDrawEntries,
      goalDays: enrollment.goalDays,
      opponentVerifiedDays,
      recoveryMultiplier: competition.rules.weeklyChallengeRecoveryMultiplier,
      verifiedDays,
    });

    return { ...score, userId: enrollment.userId, verifiedDays };
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
      const perfectMonth = buildCompetitionPeriods(competition.monthKey).every(
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
      if (bonusAdjustment !== 0) {
        await this.ledger.append(transaction, {
          ...common,
          metadata: {
            bonusDays,
            entriesAfterSettlement: bonusEntries,
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
      .selectFrom('workout_sessions')
      .select(['eligible_date', 'user_id'])
      .where('competition_id', '=', competitionId)
      .where('eligible_date', '>=', startDateKey)
      .where('eligible_date', '<=', endDateKey)
      .where('status', '=', 'verified')
      .orderBy('eligible_date')
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

function inclusiveDayCount(startDateKey: string, endDateKey: string): number {
  const start = Date.parse(`${startDateKey}T00:00:00.000Z`);
  const end = Date.parse(`${endDateKey}T00:00:00.000Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
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
