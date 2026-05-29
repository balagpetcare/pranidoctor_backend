export { RULE_VERSION } from './feed-recommendation.constants.js';
export {
  FeedRecommendationController,
  getFeedRecommendationController,
} from './feed-recommendation.controller.js';
export type {
  FeedRecommendationDto,
  FeedRecommendationHistoryItemDto,
  RecommendationItem,
  RecommendationTotals,
} from './feed-recommendation.dto.js';
export {
  createFeedRecommendationModule,
  FeedRecommendationModule,
} from './feed-recommendation.module.js';
export { getFeedRecommendationRepository } from './feed-recommendation.repository.js';
export {
  buildRecommendationEngineInput,
  resolveEngineWeightKg,
  runRecommendationEngine,
} from './recommendation.engine.js';
export { runIntelligenceEngine, runIntelligenceEngineSync } from './intelligence.engine.js';
export { invalidateRulesCache, loadIntelligenceRules } from './engine/rules-loader.js';
export type { IntelligenceRules } from './engine/rules-schema.js';
export { DEFAULT_MODULES } from './engine/pipeline.js';
export {
  FeedRecommendationError,
  FeedRecommendationService,
  getFeedRecommendationService,
  mapFeedRecommendationError,
} from './feed-recommendation.service.js';
export type {
  ActiveFeedItemRow,
  FeedRecommendationErrorCode,
  LivestockIntelligenceContext,
  RecommendationAlternative,
  RecommendationEngineInput,
  RecommendationExplanation,
  RecommendationIntelligencePayload,
  RecommendationResult,
  RecommendationScoreBreakdown,
} from './feed-recommendation.types.js';
export {
  acceptRecommendationBodySchema,
  dailyRecommendationQuerySchema,
  previewRecommendationBodySchema,
} from './feed-recommendation.validator.js';
export type {
  AcceptRecommendationBody,
  DailyRecommendationQuery,
  PreviewRecommendationBody,
} from './feed-recommendation.validator.js';
