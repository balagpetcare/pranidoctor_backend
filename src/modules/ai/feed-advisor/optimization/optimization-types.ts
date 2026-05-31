import type {
  LivestockSpecies,
  ProductionStage,
} from '../../../../generated/prisma/index.js';

export type FeedPerformanceRecord = {
  id: string;
  customerId: string;
  livestockId: string;
  formulationId: string;
  species: LivestockSpecies;
  productionStage: ProductionStage;
  feedingDate: Date;
  actualDmIntakeKg: number;
  targetDmIntakeKg: number;
  actualCostTk: number;
  targetCostTk: number;
  outcomeMetrics: OutcomeMetrics;
  feedback?: FarmerFeedback;
  createdAt: Date;
};

export type OutcomeMetrics = {
  milkYieldLiters?: number;
  adgKg?: number;
  bodyConditionScore?: number;
  eggProduction?: number;
  feedConversionRatio?: number;
  healthObservations?: string[];
};

export type FarmerFeedback = {
  satisfactionScore: 1 | 2 | 3 | 4 | 5;
  comments?: string;
  issuesReported?: string[];
  ingredientSubstitutions?: {
    original: string;
    substitute: string;
    reason: string;
  }[];
};

export type FormulationAnalytics = {
  formulationId: string;
  totalUsageCount: number;
  avgSatisfactionScore: number;
  avgCostDeviation: number;
  avgNutrientDeviation: Record<string, number>;
  commonSubstitutions: SubstitutionPattern[];
  performanceByStage: StagePerformance[];
  seasonalVariations: SeasonalVariation[];
};

export type SubstitutionPattern = {
  originalIngredient: string;
  substituteIngredient: string;
  frequency: number;
  avgCostDelta: number;
  avgPerformanceDelta: number;
};

export type StagePerformance = {
  productionStage: ProductionStage;
  usageCount: number;
  avgOutcome: number;
  feedbackScore: number;
};

export type SeasonalVariation = {
  month: number;
  avgCostIndex: number;
  ingredientAvailability: Record<string, number>;
  recommendedAdjustments: string[];
};

export type OptimizationRecommendation = {
  type: 'cost' | 'nutrition' | 'availability' | 'performance';
  priority: 'high' | 'medium' | 'low';
  descriptionBn: string;
  descriptionEn: string;
  suggestedChange: SuggestedChange;
  expectedImpact: {
    costDelta: number;
    nutritionDelta: Record<string, number>;
    confidenceScore: number;
  };
};

export type SuggestedChange =
  | { type: 'substitute'; original: string; replacement: string; reason: string }
  | { type: 'adjust_proportion'; ingredient: string; currentPercent: number; suggestedPercent: number }
  | { type: 'add_ingredient'; ingredient: string; suggestedPercent: number; reason: string }
  | { type: 'remove_ingredient'; ingredient: string; reason: string };

export type IngredientPriceUpdate = {
  ingredientCode: string;
  previousPrice: number;
  newPrice: number;
  changePercent: number;
  effectiveDate: Date;
  source: string;
};

export type PriceAlertConfig = {
  ingredientCode: string;
  alertThresholdPercent: number;
  direction: 'increase' | 'decrease' | 'both';
  notifyCustomerIds: string[];
};

export type PriceAlert = {
  id: string;
  ingredientCode: string;
  ingredientName: string;
  previousPrice: number;
  currentPrice: number;
  changePercent: number;
  direction: 'increase' | 'decrease';
  alertedAt: Date;
  suggestedAction: string;
};
