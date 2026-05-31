import type {
  BdFeedAvailability,
  BreedCategory,
  FeedPriceVolatility,
  LivestockSpecies,
  ProductionStage,
  VkVersionStatus,
} from '../../../generated/prisma/index.js';

export type FeedKnowledgeEntityType =
  | 'FEED_INGREDIENT'
  | 'NUTRIENT_REQUIREMENT'
  | 'RATION_TEMPLATE'
  | 'TOXIC_FEED_ALERT'
  | 'FEEDING_GUIDELINE'
  | 'SEASONAL_CALENDAR'
  | 'ANTINUTRIENT_LIMIT';

export type FeedGraphEdgeType =
  | 'NUTRIENT_FOR'
  | 'CONTAINS'
  | 'TOXICITY_OF'
  | 'ANTINUTRIENT_IN'
  | 'SEASONAL_AVAILABILITY'
  | 'SUBSTITUTES_FOR'
  | 'RESTRICTED_FOR';

export type FeedIngredientComposition = {
  dmPercent: number;
  cpPercent?: number;
  tdnPercent?: number;
  ndfPercent?: number;
  adfPercent?: number;
  meValueMjPerKg?: number;
  caPercent?: number;
  pPercent?: number;
  cfPercent?: number;
  eePercent?: number;
  ashPercent?: number;
};

export type IngredientMaxInclusion = {
  species: LivestockSpecies;
  productionStage: ProductionStage;
  maxPercentDm: number;
  reason?: string;
};

export type AntinutrientInfo = {
  compound: string;
  threshold: string;
  effect: string;
  mitigation?: string;
};

export type SeasonalAvailability = {
  month: number;
  availability: 'high' | 'medium' | 'low' | 'none';
  priceIndex: number;
};

export type FeedIngredientInput = {
  ingredientCode: string;
  localNamesBn: string[];
  localNamesEn?: string[];
  composition: FeedIngredientComposition;
  bdAvailability: BdFeedAvailability;
  seasonality?: SeasonalAvailability[];
  avgPriceBdtPerKg?: number;
  priceVolatility?: FeedPriceVolatility;
  speciesRestrictions?: LivestockSpecies[];
  antinutrients?: AntinutrientInfo[];
  maxInclusions?: IngredientMaxInclusion[];
  feedItemId?: string;
  sourceAttributions?: string[];
};

export type NutrientRequirementInput = {
  species: LivestockSpecies;
  productionStage: ProductionStage;
  breedCategory?: BreedCategory;
  weightRangeMinKg?: number;
  weightRangeMaxKg?: number;
  dmIntakeKgPerDay?: number;
  dmIntakePercentBw?: number;
  cpPercentMin?: number;
  cpPercentMax?: number;
  tdnPercentMin?: number;
  meMinMjPerKg?: number;
  ndfPercentMax?: number;
  caPercentMin?: number;
  pPercentMin?: number;
  milkYieldLiters?: number;
  adgKg?: number;
  sourceNotes?: string;
};

export type ToxicFeedAlertInput = {
  substance: string;
  commonNamesBn: string[];
  commonNamesEn?: string[];
  speciesAffected: LivestockSpecies[];
  toxicThreshold: string;
  lethalThreshold?: string;
  clinicalSignsBn: string[];
  clinicalSignsEn?: string[];
  onsetTime?: string;
  immediateActionBn: string;
  immediateActionEn: string;
  vetRequired?: boolean;
  relatedIngredientCodes?: string[];
  sourceAttributions?: string[];
};

export type RationIngredient = {
  ingredientCode: string;
  percentDm: number;
  percentAsFed?: number;
};

export type RationTemplateInput = {
  templateCode: string;
  templateNameBn: string;
  templateNameEn: string;
  species: LivestockSpecies;
  productionStage: ProductionStage;
  targetProduction?: string;
  ingredients: RationIngredient[];
  concentrateRatio?: number;
  roughageRatio?: number;
  suitabilityNotesBn?: string;
  suitabilityNotesEn?: string;
  sourceAttributions?: string[];
};

export type SeasonalCalendarInput = {
  month: number;
  regionCode?: string;
  availableIngredientCodes: string[];
  peakIngredientCodes?: string[];
  scarcityIngredientCodes?: string[];
  priceIndex?: Record<string, number>;
  guidelinesBn?: string;
  guidelinesEn?: string;
  sourceAttributions?: string[];
};

export type FeedKnowledgeGraphEdgeInput = {
  edgeType: FeedGraphEdgeType;
  fromEntitySlug: string;
  toEntitySlug: string;
  weight?: number;
  labelBn?: string;
  labelEn?: string;
  metadata?: Record<string, unknown>;
};

export type FeedIngredientView = {
  id: string;
  versionId: string;
  ingredientCode: string;
  localNamesBn: string[];
  localNamesEn: string[];
  composition: FeedIngredientComposition;
  bdAvailability: BdFeedAvailability;
  seasonality: SeasonalAvailability[];
  avgPriceBdtPerKg: number | null;
  priceVolatility: FeedPriceVolatility;
  speciesRestrictions: LivestockSpecies[];
  antinutrients: AntinutrientInfo[];
  maxInclusions: IngredientMaxInclusion[];
  feedItemId: string | null;
  status: VkVersionStatus;
  evidenceLevel: string | null;
  confidenceScore: number | null;
};

export type NutrientRequirementView = {
  id: string;
  versionId: string;
  species: LivestockSpecies;
  productionStage: ProductionStage;
  breedCategory: BreedCategory | null;
  weightRange: { minKg: number | null; maxKg: number | null };
  dmIntake: { kgPerDay: number | null; percentBw: number | null };
  cpPercent: { min: number | null; max: number | null };
  tdnPercentMin: number | null;
  meMinMjPerKg: number | null;
  ndfPercentMax: number | null;
  caPercentMin: number | null;
  pPercentMin: number | null;
  productionTargets: { milkYieldLiters: number | null; adgKg: number | null };
  status: VkVersionStatus;
};

export type ToxicFeedAlertView = {
  id: string;
  versionId: string;
  substance: string;
  commonNamesBn: string[];
  commonNamesEn: string[];
  speciesAffected: LivestockSpecies[];
  toxicThreshold: string;
  lethalThreshold: string | null;
  clinicalSignsBn: string[];
  clinicalSignsEn: string[];
  onsetTime: string | null;
  immediateActionBn: string;
  immediateActionEn: string;
  vetRequired: boolean;
  relatedIngredientCodes: string[];
  status: VkVersionStatus;
};

export type FeedStructuredFact = {
  factId: string;
  factType: FeedStructuredFactType;
  species?: LivestockSpecies;
  productionStage?: ProductionStage;
  ingredientCode?: string;
  value: number | string | boolean;
  unit?: string;
  evidenceLevel: string;
  confidenceScore: number;
  sourceCitation: string;
};

export type FeedStructuredFactType =
  | 'NUTRIENT_CP_PERCENT'
  | 'NUTRIENT_TDN_PERCENT'
  | 'NUTRIENT_DM_INTAKE_KG'
  | 'NUTRIENT_ME_MJ_PER_KG'
  | 'NUTRIENT_NDF_MAX'
  | 'NUTRIENT_CA_MIN'
  | 'NUTRIENT_P_MIN'
  | 'INGREDIENT_COMPOSITION'
  | 'INGREDIENT_PRICE_BDT'
  | 'INGREDIENT_MAX_INCLUSION'
  | 'TOXIC_THRESHOLD'
  | 'FORMULATION_COST';
