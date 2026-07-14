import { z } from 'zod';
import type { CompetitionMode, JsonValue } from '../../database/database.types';

const commonCompetitionRules = z.object({
  minSessionMinutes: z.number().int().min(10).max(240),
  minHeartRateSamples: z.number().int().min(0).max(10_000),
  requireDeviceAttestation: z.boolean(),
  requireFaceCheck: z.boolean(),
  requireGymQr: z.boolean(),
});

export const cashCompetitionRulesSchema = commonCompetitionRules
  .extend({
    signupPrizeDrawEntries: z.number().int().min(1).max(1_000),
    verifiedSessionCategoryScore: z.number().int().min(0).max(1_000),
    verifiedSessionPrizeDrawEntries: z.number().int().min(0).max(1_000),
    payoutPoolAmountMinor: z.number().int().positive().safe(),
    payoutWinnerCount: z.number().int().positive().max(100_000),
    payoutExponent: z.number().positive().max(1),
  })
  .strict();

export const nonCashDemoCompetitionRulesSchema = commonCompetitionRules
  .extend({
    payoutExponent: z.literal(0),
    payoutPoolAmountMinor: z.literal(0),
    payoutWinnerCount: z.literal(0),
    signupPrizeDrawEntries: z.literal(0),
    verifiedSessionCategoryScore: z.literal(0),
    verifiedSessionPrizeDrawEntries: z.literal(0),
  })
  .strict();

export const competitionRulesSchema = cashCompetitionRulesSchema;

export type CompetitionRules =
  | z.infer<typeof cashCompetitionRulesSchema>
  | z.infer<typeof nonCashDemoCompetitionRulesSchema>;

export function parseCompetitionRules(
  value: JsonValue,
  mode: CompetitionMode = 'cash',
): CompetitionRules {
  return mode === 'non_cash_demo'
    ? nonCashDemoCompetitionRulesSchema.parse(value)
    : cashCompetitionRulesSchema.parse(value);
}
