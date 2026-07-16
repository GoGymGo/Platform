import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import {
  parseCompetitionRules,
  type CompetitionRules,
} from '../competitions/competition-rules';

const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const linearRingSchema = z
  .array(positionSchema)
  .min(4)
  .max(10_000)
  .superRefine((ring, context) => {
    const first = ring[0];
    const last = ring.at(-1);
    if (!last || first[0] !== last[0] || first[1] !== last[1]) {
      context.addIssue({
        code: 'custom',
        message: 'A polygon ring must end at its starting coordinate.',
      });
    }
  });
const polygonSchema = z.array(linearRingSchema).min(1).max(1_000);

export const multiPolygonSchema = z
  .object({
    coordinates: z.array(polygonSchema).min(1).max(1_000),
    type: z.literal('MultiPolygon'),
  })
  .strict();

export type MultiPolygon = z.infer<typeof multiPolygonSchema>;

export function parseMultiPolygon(value: unknown): MultiPolygon {
  const parsed = multiPolygonSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'REGION_BOUNDARY_INVALID',
      message: 'The boundary must be a valid closed GeoJSON MultiPolygon.',
    });
  }
  return parsed.data;
}

export function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new BadRequestException({
      code: 'TIMEZONE_INVALID',
      message: 'The timezone must be a recognized IANA timezone.',
    });
  }
}

export interface CompetitionSchedule {
  endsAt: Date;
  registrationClosesAt: Date;
  registrationOpensAt: Date;
  startsAt: Date;
}

export function parseCompetitionSchedule(input: {
  endsAt: string;
  registrationClosesAt: string;
  registrationOpensAt: string;
  startsAt: string;
}): CompetitionSchedule {
  const schedule = {
    endsAt: new Date(input.endsAt),
    registrationClosesAt: new Date(input.registrationClosesAt),
    registrationOpensAt: new Date(input.registrationOpensAt),
    startsAt: new Date(input.startsAt),
  };
  if (
    schedule.registrationOpensAt >= schedule.registrationClosesAt ||
    schedule.registrationClosesAt > schedule.startsAt ||
    schedule.startsAt >= schedule.endsAt
  ) {
    throw new BadRequestException({
      code: 'COMPETITION_SCHEDULE_INVALID',
      message:
        'Registration open, registration close, competition start, and competition end must be chronological.',
    });
  }
  return schedule;
}

export function assertUniqueGoalBrackets(
  brackets: { goalDays: number }[],
): void {
  if (
    new Set(brackets.map((bracket) => bracket.goalDays)).size !==
    brackets.length
  ) {
    throw new BadRequestException({
      code: 'GOAL_BRACKETS_DUPLICATED',
      message: 'Each goal-day bracket must be unique.',
    });
  }
}

export function parseAdminCompetitionRules(value: unknown): CompetitionRules {
  try {
    return parseCompetitionRules(value as never);
  } catch {
    throw new BadRequestException({
      code: 'COMPETITION_RULES_INVALID',
      message: 'The competition rules do not match the supported rule schema.',
    });
  }
}
