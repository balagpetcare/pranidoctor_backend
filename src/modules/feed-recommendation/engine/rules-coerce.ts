import type { IntelligenceRules } from './rules-schema.js';
import { parseIntelligenceRules } from './rules-schema.js';

/** Upgrade bd-v1 rule files to bd-v2 shape with safe defaults. */
export function coerceLegacyRules(raw: unknown): IntelligenceRules {
  try {
    return parseIntelligenceRules(raw);
  } catch {
    const legacy = raw as Record<string, unknown>;
    const v2Defaults = {
      scoringWeights: {
        nutritionMatch: 0.4,
        affordability: 0.3,
        seasonalFit: 0.15,
        suitability: 0.15,
      },
      nutritionTargets: {
        default: { default: { cpPercent: 12, tdnPercent: 65 } },
      },
      lactation: {
        enabledSpecies: ['COW', 'BUFFALO'],
        dmPerLiterMilk: 0.4,
        defaultDailyMilkLiters: { COW: 8, BUFFALO: 6 },
        phases: {
          early: { maxDays: 100, concentrateBoostPercent: 15, cpBoostPercent: 10 },
          mid: { maxDays: 200, concentrateBoostPercent: 5, cpBoostPercent: 5 },
          late: { maxDays: 305 },
          dry: { concentrateMultiplier: 0.7, warningBn: 'শুকনো সময় — ক্ষুধাহানিক কমান' },
        },
      },
      seasonal: {},
      diseaseRules: [],
      affordability: {
        alternativeMinScoreRatio: 0.85,
        maxBudgetBdtDefault: null,
        lowCostWarningThresholdBdt: 500,
      },
      bangladeshContext: {
        preferredCodes: [],
        monsoonRoughageCodes: [],
        priceCeilingMultiplier: 1.5,
      },
    };

    const seasonalWarnings = legacy.seasonalWarnings as Record<
      string,
      { months: number[]; warningBn: string }
    > | undefined;

    const seasonal: IntelligenceRules['seasonal'] = {};
    if (seasonalWarnings) {
      for (const [key, val] of Object.entries(seasonalWarnings)) {
        seasonal[key] = {
          months: val.months,
          warningBn: val.warningBn,
        };
      }
    }

    return parseIntelligenceRules({
      ...v2Defaults,
      ...legacy,
      version: 'bd-v2-coerced',
      seasonal,
    });
  }
}
