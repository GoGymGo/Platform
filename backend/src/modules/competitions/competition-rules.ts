import { z } from 'zod';
import type { JsonValue } from '../../database/database.types';

const commonCompetitionRules = z.object({
  minSessionMinutes: z.number().int().min(10).max(240),
  minHeartRateSamples: z.number().int().min(0).max(10_000),
  requireDeviceAttestation: z.boolean(),
  requirePresenceCheck: z.boolean(),
  requireGymQr: z.boolean(),
});

export const competitionRulesSchema = commonCompetitionRules
  .extend({
    categoryPodiumMultipliers: z
      .object({
        '1': z.literal(3),
        '2': z.literal(2),
        '3': z.literal(1.5),
      })
      .strict(),
    perfectMonthMultiplier: z.literal(10),
    signupPrizeDrawEntries: z.number().int().min(1).max(1_000),
    verifiedSessionCategoryScore: z.number().int().min(0).max(1_000),
    verifiedSessionPrizeDrawEntries: z.number().int().min(0).max(1_000),
    weeklyChallengeBothHitMultiplier: z.literal(2),
    weeklyChallengeRecoveryMultiplier: z.literal(3),
  })
  .strict();

export type CompetitionRules = z.infer<typeof competitionRulesSchema>;

export function parseCompetitionRules(value: JsonValue): CompetitionRules {
  return competitionRulesSchema.parse(value);
}
