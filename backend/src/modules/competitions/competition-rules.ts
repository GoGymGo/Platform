import { z } from 'zod';
import type { JsonValue } from '../../database/database.types';

const commonCompetitionRules = z.object({
  minSessionMinutes: z.number().int().min(10).max(240),
  minHeartRateSamples: z.number().int().min(0).max(10_000),
  requireDeviceAttestation: z.boolean(),
  requireFaceCheck: z.boolean(),
  requireGymQr: z.boolean(),
});

export const competitionRulesSchema = commonCompetitionRules
  .extend({
    signupPrizeDrawEntries: z.number().int().min(1).max(1_000),
    verifiedSessionCategoryScore: z.number().int().min(0).max(1_000),
    verifiedSessionPrizeDrawEntries: z.number().int().min(0).max(1_000),
  })
  .strict();

export type CompetitionRules = z.infer<typeof competitionRulesSchema>;

export function parseCompetitionRules(value: JsonValue): CompetitionRules {
  return competitionRulesSchema.parse(value);
}
