import { z } from 'zod';
import type { JsonValue } from '../../database/database.types';

export const competitionRulesSchema = z
  .object({
    minSessionMinutes: z.number().int().min(10).max(240),
    minHeartRateSamples: z.number().int().min(0).max(10_000),
    requireDeviceAttestation: z.boolean(),
    requireFaceCheck: z.boolean(),
    requireGymQr: z.boolean(),
    signupPrizeDrawEntries: z.number().int().min(1).max(1_000),
    verifiedSessionCategoryScore: z.number().int().min(0).max(1_000),
    verifiedSessionPrizeDrawEntries: z.number().int().min(0).max(1_000),
    payoutPoolAmountMinor: z.number().int().positive().safe(),
    payoutWinnerCount: z.number().int().positive().max(100_000),
    payoutExponent: z.number().positive().max(1),
  })
  .strict();

export type CompetitionRules = z.infer<typeof competitionRulesSchema>;

export function parseCompetitionRules(value: JsonValue): CompetitionRules {
  return competitionRulesSchema.parse(value);
}
