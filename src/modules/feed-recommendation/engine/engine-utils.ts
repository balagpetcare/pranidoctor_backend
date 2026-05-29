import type { FeedCategory } from '@/generated/prisma/client';

import type { EnginePipelineState } from '../feed-recommendation.types.js';
import type { IntelligenceRules } from './rules-schema.js';

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function resolveAllocation(
  rules: IntelligenceRules,
  species: string,
  purpose: string | null,
): Record<string, number> {
  const speciesRules =
    rules.categoryAllocation[species] ?? rules.categoryAllocation.default ?? {};
  const purposeKey = purpose ?? 'default';
  return { ...(speciesRules[purposeKey] ?? speciesRules.default ?? {}) };
}

export function normalizeAllocation(allocation: Record<string, number>): Record<string, number> {
  const sum = Object.values(allocation).reduce((s, v) => s + v, 0);
  if (sum <= 0) return allocation;
  if (Math.abs(sum - 1) <= 0.01) return allocation;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(allocation)) {
    out[k] = v / sum;
  }
  return out;
}

export function resolveNutritionTargets(
  rules: IntelligenceRules,
  species: string,
  purpose: string | null,
): { cpPercent: number; tdnPercent: number } {
  const speciesTargets =
    rules.nutritionTargets[species] ?? rules.nutritionTargets.default ?? {};
  const purposeKey = purpose ?? 'default';
  return (
    speciesTargets[purposeKey] ??
    speciesTargets.default ?? { cpPercent: 12, tdnPercent: 65 }
  );
}

export function addExplanation(
  state: EnginePipelineState,
  ruleId: string,
  ruleNameBn: string,
  effect: string,
  impactBn: string,
): EnginePipelineState {
  return {
    ...state,
    appliedRuleIds: [...state.appliedRuleIds, ruleId],
    explanations: [
      ...state.explanations,
      { ruleId, ruleNameBn, effect, impactBn },
    ],
  };
}

export function itemsInCategory(
  feedItems: EnginePipelineState['feedItems'],
  category: FeedCategory,
): EnginePipelineState['feedItems'] {
  return feedItems.filter((i) => i.category === category);
}

export function parseSuitabilitySpecies(suitabilityJson: unknown): string[] {
  if (!suitabilityJson || typeof suitabilityJson !== 'object') return [];
  const raw = (suitabilityJson as { animalTypes?: unknown }).animalTypes;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

export function matchesDiseaseKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export function computeAgeMonths(dateOfBirth: Date | null, planDate: Date): number | null {
  if (!dateOfBirth) return null;
  const months =
    (planDate.getUTCFullYear() - dateOfBirth.getUTCFullYear()) * 12 +
    (planDate.getUTCMonth() - dateOfBirth.getUTCMonth());
  return Math.max(0, months);
}

/** Days since last calving; null if unknown. */
export function daysSinceCalving(lastCalvingDate: Date | null, planDate: Date): number | null {
  if (!lastCalvingDate) return null;
  const ms = planDate.getTime() - lastCalvingDate.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function scoreFeedItem(params: {
  item: EnginePipelineState['feedItems'][number];
  category: string;
  species: string;
  month: number;
  weights: IntelligenceRules['scoringWeights'];
  maxPriceInCategory: number;
  preferredCodes: string[];
  monsoonRoughageCodes: string[];
  cpTarget: number;
  tdnTarget: number;
  isMonsoon: boolean;
}): number {
  const {
    item,
    species,
    month,
    weights,
    maxPriceInCategory,
    preferredCodes,
    monsoonRoughageCodes,
    cpTarget,
    tdnTarget,
    isMonsoon,
  } = params;

  const cp = item.nutrition?.cpPercent ?? cpTarget;
  const tdn = item.nutrition?.tdnPercent ?? tdnTarget;
  const cpDelta = Math.abs(cp - cpTarget) / Math.max(cpTarget, 1);
  const tdnDelta = Math.abs(tdn - tdnTarget) / Math.max(tdnTarget, 1);
  const nutritionMatch = clamp01(1 - (cpDelta * 0.6 + tdnDelta * 0.4));

  const price = item.approxPriceBdt ?? maxPriceInCategory;
  const affordability =
    maxPriceInCategory > 0 ? clamp01(1 - price / maxPriceInCategory) : 0.5;

  let seasonalFit = 0.7;
  if (item.isSeasonal) seasonalFit = 0.85;
  if (isMonsoon && monsoonRoughageCodes.includes(item.code)) seasonalFit = 1;
  if (params.category === 'GREEN' && isMonsoon) seasonalFit *= 0.6;

  const suited = parseSuitabilitySpecies(item.suitabilityJson);
  let suitability = suited.length === 0 || suited.includes(species) ? 1 : 0.3;
  if (preferredCodes.includes(item.code)) suitability = Math.min(1, suitability + 0.15);

  const raw =
    nutritionMatch * weights.nutritionMatch +
    affordability * weights.affordability +
    seasonalFit * weights.seasonalFit +
    suitability * weights.suitability;

  void month;
  return clamp100(raw * 100);
}
