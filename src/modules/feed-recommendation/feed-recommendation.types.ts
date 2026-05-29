import type {
  LivestockGender,
  LivestockHealthStatus,
  LivestockPurpose,
  LivestockSpecies,
  PregnancyStatus,
} from '@/generated/prisma/client';

import type { IntelligenceRules } from './engine/rules-schema.js';

export type RecommendationEngineInput = {
  species: LivestockSpecies;
  gender: LivestockGender;
  weightKg: number;
  ageMonths: number | null;
  purpose: LivestockPurpose | null;
  pregnancyStatus: PregnancyStatus | null;
  healthStatus: LivestockHealthStatus;
};

/** Extended context for intelligence engine (optional fields). */
export type LivestockIntelligenceContext = {
  lactationNumber: number | null;
  lastCalvingDate: Date | null;
  estimatedDailyMilkLiters: number | null;
  recentDiseaseKeywords: string[];
  budgetBdt: number | null;
};

export type FeedItemNutrition = {
  cpPercent: number | null;
  tdnPercent: number | null;
  dmPercent: number | null;
};

export type ActiveFeedItemRow = {
  id: string;
  code: string;
  category: string;
  nameBn: string;
  approxPriceBdt: number | null;
  sortOrder: number;
  isSeasonal: boolean;
  suitabilityJson: unknown;
  nutrition: FeedItemNutrition | null;
};

export type RecommendationItem = {
  feedItemId: string;
  nameBn: string;
  amountKg: number;
  costBdt: number;
  /** Item-level score 0–100 for analytics. */
  itemScore?: number;
};

export type RecommendationTotals = {
  dryMatterKg: number;
  estimatedCostBdt: number;
  itemCount: number;
  /** Extended analytics payload stored in totalsJson. */
  intelligence?: RecommendationIntelligencePayload;
};

export type RecommendationScoreBreakdown = {
  nutritionFit: number;
  affordability: number;
  seasonalFit: number;
  healthSafety: number;
  overall: number;
};

export type RecommendationExplanation = {
  ruleId: string;
  ruleNameBn: string;
  effect: string;
  impactBn: string;
};

export type RecommendationAlternative = {
  originalFeedItemId: string;
  alternativeFeedItemId: string;
  nameBn: string;
  savingsBdt: number;
  tradeoffBn: string;
};

export type RecommendationIntelligencePayload = {
  engineVersion: string;
  rulesSource: 'setting' | 'file';
  rulesVersion: string;
  appliedRuleIds: string[];
  scores: RecommendationScoreBreakdown;
  explanations: RecommendationExplanation[];
  alternatives: RecommendationAlternative[];
  nutritionTargets: { cpPercent: number; tdnPercent: number };
  nutritionAchieved: { cpPercent: number; tdnPercent: number };
};

export type RecommendationResult = {
  ruleVersion: string;
  planDate: string;
  items: RecommendationItem[];
  totals: RecommendationTotals;
  warnings: string[];
  disclaimerBn: string;
  /** Top-level mirrors for API consumers (also nested under totals.intelligence). */
  scores?: RecommendationScoreBreakdown;
  explanations?: RecommendationExplanation[];
  alternatives?: RecommendationAlternative[];
};

export type FeedRecommendationErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NO_FEED_ITEMS';

/** Mutable pipeline state — pure transforms between rule modules. */
export type EnginePipelineState = {
  rules: IntelligenceRules;
  rulesSource: 'setting' | 'file';
  input: RecommendationEngineInput;
  context: LivestockIntelligenceContext;
  feedItems: ActiveFeedItemRow[];
  planDate: Date;
  totalDmKg: number;
  allocation: Record<string, number>;
  cpTargetPercent: number;
  tdnTargetPercent: number;
  warnings: string[];
  explanations: RecommendationExplanation[];
  appliedRuleIds: string[];
  healthSafetyScore: number;
  seasonalFitScore: number;
  selectedItems: RecommendationItem[];
  alternatives: RecommendationAlternative[];
};

export type RuleModule = {
  id: string;
  nameBn: string;
  apply: (state: EnginePipelineState) => EnginePipelineState;
};
