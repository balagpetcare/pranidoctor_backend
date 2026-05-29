import { z } from 'zod';

const categoryAllocationSchema = z.record(z.string(), z.number().min(0).max(1));

const nutritionTargetSchema = z.object({
  cpPercent: z.number().min(0).max(100),
  tdnPercent: z.number().min(0).max(100),
});

export const intelligenceRulesSchema = z.object({
  version: z.string(),
  disclaimerBn: z.string(),
  baseDmPercentOfBodyWeight: z.record(z.string(), z.number().positive()),
  defaultWeightKg: z.record(z.string(), z.number().positive()),
  nutritionTargets: z.record(z.string(), z.record(z.string(), nutritionTargetSchema)),
  categoryAllocation: z.record(z.string(), z.record(z.string(), categoryAllocationSchema)),
  scoringWeights: z.object({
    nutritionMatch: z.number().min(0).max(1),
    affordability: z.number().min(0).max(1),
    seasonalFit: z.number().min(0).max(1),
    suitability: z.number().min(0).max(1),
  }),
  modifiers: z.object({
    healthStatus: z.record(
      z.string(),
      z.object({
        concentrateMultiplier: z.number().positive().optional(),
        warningBn: z.string().optional(),
      }),
    ),
    pregnancyStatus: z.record(
      z.string(),
      z.object({
        concentrateBoostPercent: z.number().optional(),
        mineralBoostPercent: z.number().optional(),
        warningBn: z.string().optional(),
      }),
    ),
    youngAnimalMonths: z.number().int().min(0),
    youngAnimalConcentrateBoostPercent: z.number(),
  }),
  lactation: z.object({
    enabledSpecies: z.array(z.string()),
    dmPerLiterMilk: z.number().positive(),
    defaultDailyMilkLiters: z.record(z.string(), z.number().positive()),
    phases: z.record(
      z.string(),
      z.object({
        maxDays: z.number().int().positive().optional(),
        concentrateBoostPercent: z.number().optional(),
        cpBoostPercent: z.number().optional(),
        concentrateMultiplier: z.number().positive().optional(),
        warningBn: z.string().optional(),
      }),
    ),
  }),
  seasonal: z.record(
    z.string(),
    z.object({
      months: z.array(z.number().int().min(1).max(12)),
      allocationShift: z.record(z.string(), z.number()).optional(),
      warningBn: z.string(),
    }),
  ),
  diseaseRules: z.array(
    z.object({
      id: z.string(),
      matchKeywords: z.array(z.string()),
      concentrateMultiplier: z.number().positive().optional(),
      greenMultiplier: z.number().positive().optional(),
      mineralBoostPercent: z.number().optional(),
      warningBn: z.string(),
    }),
  ),
  affordability: z.object({
    alternativeMinScoreRatio: z.number().min(0).max(1),
    maxBudgetBdtDefault: z.number().positive().nullable(),
    lowCostWarningThresholdBdt: z.number().positive().optional(),
  }),
  bangladeshContext: z.object({
    preferredCodes: z.array(z.string()),
    monsoonRoughageCodes: z.array(z.string()),
    priceCeilingMultiplier: z.number().positive(),
  }),
});

export type IntelligenceRules = z.infer<typeof intelligenceRulesSchema>;

export function parseIntelligenceRules(raw: unknown): IntelligenceRules {
  return intelligenceRulesSchema.parse(raw);
}
