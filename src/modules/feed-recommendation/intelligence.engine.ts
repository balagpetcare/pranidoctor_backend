import type {
  ActiveFeedItemRow,
  LivestockIntelligenceContext,
  RecommendationEngineInput,
  RecommendationResult,
} from './feed-recommendation.types.js';
import {
  buildRecommendationFromState,
  createInitialState,
  runPipeline,
} from './engine/pipeline.js';
import { loadIntelligenceRules, loadIntelligenceRulesSync } from './engine/rules-loader.js';
import type { IntelligenceRules } from './engine/rules-schema.js';

export async function runIntelligenceEngine(params: {
  input: RecommendationEngineInput;
  context?: Partial<LivestockIntelligenceContext>;
  feedItems: ActiveFeedItemRow[];
  planDate: Date;
}): Promise<RecommendationResult> {
  const { rules, source } = await loadIntelligenceRules();

  const context: LivestockIntelligenceContext = {
    lactationNumber: params.context?.lactationNumber ?? null,
    lastCalvingDate: params.context?.lastCalvingDate ?? null,
    estimatedDailyMilkLiters: params.context?.estimatedDailyMilkLiters ?? null,
    recentDiseaseKeywords: params.context?.recentDiseaseKeywords ?? [],
    budgetBdt: params.context?.budgetBdt ?? null,
  };

  const state = createInitialState({
    rules,
    rulesSource: source,
    input: params.input,
    context,
    feedItems: params.feedItems,
    planDate: params.planDate,
  });

  return buildRecommendationFromState(runPipeline(state));
}

/** Sync entry for unit tests and legacy `runRecommendationEngine`. */
export function runIntelligenceEngineSync(params: {
  input: RecommendationEngineInput;
  context?: Partial<LivestockIntelligenceContext>;
  feedItems: ActiveFeedItemRow[];
  planDate: Date;
  rulesOverride?: IntelligenceRules;
  rulesSource?: 'setting' | 'file';
}): RecommendationResult {
  const rules = params.rulesOverride ?? loadIntelligenceRulesSync();

  const context: LivestockIntelligenceContext = {
    lactationNumber: params.context?.lactationNumber ?? null,
    lastCalvingDate: params.context?.lastCalvingDate ?? null,
    estimatedDailyMilkLiters: params.context?.estimatedDailyMilkLiters ?? null,
    recentDiseaseKeywords: params.context?.recentDiseaseKeywords ?? [],
    budgetBdt: params.context?.budgetBdt ?? null,
  };

  const state = createInitialState({
    rules,
    rulesSource: params.rulesSource ?? 'file',
    input: params.input,
    context,
    feedItems: params.feedItems,
    planDate: params.planDate,
  });

  return buildRecommendationFromState(runPipeline(state));
}
