import { ENGINE_VERSION, RULE_VERSION } from '../feed-recommendation.constants.js';
import type {
  ActiveFeedItemRow,
  EnginePipelineState,
  LivestockIntelligenceContext,
  RecommendationEngineInput,
  RecommendationResult,
  RuleModule,
} from '../feed-recommendation.types.js';
import type { IntelligenceRules } from './rules-schema.js';
import { clamp100, round2, round3 } from './engine-utils.js';
import { dmBaseModule } from './modules/dm-base.module.js';
import { diseaseModule, healthModule } from './modules/health.module.js';
import { itemSelectionModule } from './modules/item-selection.module.js';
import { lactationModule } from './modules/lactation.module.js';
import { pregnancyModule } from './modules/pregnancy.module.js';
import { seasonalModule, youngAnimalModule } from './modules/seasonal.module.js';

const DEFAULT_MODULES: RuleModule[] = [
  dmBaseModule,
  lactationModule,
  pregnancyModule,
  healthModule,
  diseaseModule,
  youngAnimalModule,
  seasonalModule,
  itemSelectionModule,
];

export function createInitialState(params: {
  rules: IntelligenceRules;
  rulesSource: 'setting' | 'file';
  input: RecommendationEngineInput;
  context: LivestockIntelligenceContext;
  feedItems: ActiveFeedItemRow[];
  planDate: Date;
}): EnginePipelineState {
  return {
    rules: params.rules,
    rulesSource: params.rulesSource,
    input: params.input,
    context: params.context,
    feedItems: params.feedItems,
    planDate: params.planDate,
    totalDmKg: 0,
    allocation: {},
    cpTargetPercent: 12,
    tdnTargetPercent: 65,
    warnings: [],
    explanations: [],
    appliedRuleIds: [],
    healthSafetyScore: 100,
    seasonalFitScore: 80,
    selectedItems: [],
    alternatives: [],
  };
}

export function runPipeline(
  state: EnginePipelineState,
  modules: RuleModule[] = DEFAULT_MODULES,
): EnginePipelineState {
  return modules.reduce((s, mod) => mod.apply(s), state);
}

function computeNutritionAchieved(
  items: EnginePipelineState['selectedItems'],
  feedItems: ActiveFeedItemRow[],
  totalDmKg: number,
): { cpPercent: number; tdnPercent: number } {
  if (totalDmKg <= 0 || items.length === 0) {
    return { cpPercent: 0, tdnPercent: 0 };
  }

  let cpWeighted = 0;
  let tdnWeighted = 0;

  for (const sel of items) {
    const feed = feedItems.find((f) => f.id === sel.feedItemId);
    const dmFrac = sel.amountKg / totalDmKg;
    cpWeighted += (feed?.nutrition?.cpPercent ?? 12) * dmFrac;
    tdnWeighted += (feed?.nutrition?.tdnPercent ?? 65) * dmFrac;
  }

  return {
    cpPercent: round2(cpWeighted),
    tdnPercent: round2(tdnWeighted),
  };
}

function computeScores(state: EnginePipelineState, estimatedCostBdt: number) {
  const achieved = computeNutritionAchieved(
    state.selectedItems,
    state.feedItems,
    state.totalDmKg,
  );

  const cpDelta =
    Math.abs(achieved.cpPercent - state.cpTargetPercent)
    / Math.max(state.cpTargetPercent, 1);
  const tdnDelta =
    Math.abs(achieved.tdnPercent - state.tdnTargetPercent)
    / Math.max(state.tdnTargetPercent, 1);
  const nutritionFit = clamp100((1 - (cpDelta * 0.55 + tdnDelta * 0.45)) * 100);

  const budget =
    state.context.budgetBdt
    ?? state.rules.affordability.maxBudgetBdtDefault
    ?? estimatedCostBdt * 1.2;
  const affordability = clamp100(
    budget > 0 ? (1 - estimatedCostBdt / budget) * 100 : 70,
  );

  const overall = round2(
    nutritionFit * 0.35
      + affordability * 0.25
      + state.seasonalFitScore * 0.2
      + state.healthSafetyScore * 0.2,
  );

  return {
    nutritionFit: round2(nutritionFit),
    affordability: round2(Math.max(0, affordability)),
    seasonalFit: round2(state.seasonalFitScore),
    healthSafety: round2(state.healthSafetyScore),
    overall,
    nutritionAchieved: achieved,
  };
}

export function buildRecommendationFromState(
  state: EnginePipelineState,
): RecommendationResult {
  const estimatedCostBdt = round2(
    state.selectedItems.reduce((s, i) => s + i.costBdt, 0),
  );

  const scoreData = computeScores(state, estimatedCostBdt);

  if (state.input.weightKg <= 0) {
    state.warnings.push('ওজন অনুপস্থিত — ডিফল্ট ওজন ব্যবহার করা হয়েছে');
  }

  const intelligence = {
    engineVersion: ENGINE_VERSION,
    rulesSource: state.rulesSource,
    rulesVersion: state.rules.version,
    appliedRuleIds: state.appliedRuleIds,
    scores: {
      nutritionFit: scoreData.nutritionFit,
      affordability: scoreData.affordability,
      seasonalFit: scoreData.seasonalFit,
      healthSafety: scoreData.healthSafety,
      overall: scoreData.overall,
    },
    explanations: state.explanations,
    alternatives: state.alternatives,
    nutritionTargets: {
      cpPercent: state.cpTargetPercent,
      tdnPercent: state.tdnTargetPercent,
    },
    nutritionAchieved: scoreData.nutritionAchieved,
  };

  return {
    ruleVersion: RULE_VERSION,
    planDate: state.planDate.toISOString().slice(0, 10),
    items: state.selectedItems,
    totals: {
      dryMatterKg: round3(state.totalDmKg),
      estimatedCostBdt,
      itemCount: state.selectedItems.length,
      intelligence,
    },
    warnings: state.warnings,
    disclaimerBn: state.rules.disclaimerBn,
    scores: intelligence.scores,
    explanations: intelligence.explanations,
    alternatives: intelligence.alternatives,
  };
}

export { DEFAULT_MODULES };
