import type { RecommendationEngineInput } from './feed-recommendation.types.js';
import { loadIntelligenceRulesSync } from './engine/rules-loader.js';

function computeAgeMonths(dateOfBirth: Date | null, planDate: Date): number | null {
  if (!dateOfBirth) return null;
  const months =
    (planDate.getUTCFullYear() - dateOfBirth.getUTCFullYear()) * 12 +
    (planDate.getUTCMonth() - dateOfBirth.getUTCMonth());
  return Math.max(0, months);
}

export function resolveEngineWeightKg(
  species: string,
  weightKg: number | null | undefined,
): number {
  const rules = loadIntelligenceRulesSync();
  if (weightKg != null && weightKg > 0) return weightKg;
  return rules.defaultWeightKg[species] ?? rules.defaultWeightKg.default ?? 100;
}

export function buildRecommendationEngineInput(params: {
  species: RecommendationEngineInput['species'];
  gender: RecommendationEngineInput['gender'];
  weightKg: number | null | undefined;
  dateOfBirth: Date | null;
  purpose: RecommendationEngineInput['purpose'];
  pregnancyStatus: RecommendationEngineInput['pregnancyStatus'];
  healthStatus: RecommendationEngineInput['healthStatus'];
  planDate: Date;
}): RecommendationEngineInput {
  return {
    species: params.species,
    gender: params.gender,
    weightKg: resolveEngineWeightKg(params.species, params.weightKg),
    ageMonths: computeAgeMonths(params.dateOfBirth, params.planDate),
    purpose: params.purpose,
    pregnancyStatus: params.pregnancyStatus,
    healthStatus: params.healthStatus,
  };
}

/** @deprecated Use runIntelligenceEngine — kept for legacy imports. */
export { runIntelligenceEngineSync as runRecommendationEngine } from './intelligence.engine.js';
export { loadIntelligenceRulesSync as recommendationRules } from './engine/rules-loader.js';
