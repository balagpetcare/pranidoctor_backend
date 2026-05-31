import type {
  FeedAdvisorSessionState,
  LivestockSpecies,
  ProductionStage,
  BreedCategory,
} from '../../../generated/prisma/index.js';
import type { LivestockContext } from './knowledge/nutritional-intelligence.service.js';
import type { FormulationSolution } from './engines/formulation-types.js';

export type FeedAdvisorQuery = {
  sessionId?: string;
  customerId: string;
  userId: string;
  queryText: string;
  queryLanguage: 'bn' | 'en';
  context?: FeedAdvisorContext;
};

export type FeedAdvisorContext = {
  livestock?: LivestockContext;
  livestockId?: string;
  farmRef?: string;
  previousQueries?: string[];
  currentFeedIngredients?: string[];
  budgetTkPerDay?: number;
};

export type FeedAdvisorResponse = {
  sessionId: string;
  responseText: string;
  responseBn: string;
  responseEn: string;
  intent: FeedAdvisorIntent;
  structuredData?: FeedAdvisorStructuredData;
  citations: string[];
  followUpQuestions: string[];
  confidenceScore: number;
  disclaimers: string[];
  escalationRequired: boolean;
  escalationReason?: string;
};

export type FeedAdvisorIntent =
  | 'FORMULATION_REQUEST'
  | 'INGREDIENT_INQUIRY'
  | 'NUTRIENT_INQUIRY'
  | 'TOXIC_CHECK'
  | 'SEASONAL_AVAILABILITY'
  | 'PRICE_INQUIRY'
  | 'GENERAL_ADVICE'
  | 'CLARIFICATION_NEEDED'
  | 'OUT_OF_SCOPE';

export type FeedAdvisorStructuredData =
  | { type: 'formulation'; data: FormulationSolution }
  | { type: 'ingredient_list'; data: IngredientListData }
  | { type: 'nutrient_info'; data: NutrientInfoData }
  | { type: 'toxic_alert'; data: ToxicAlertData }
  | { type: 'seasonal_calendar'; data: SeasonalCalendarData }
  | { type: 'price_comparison'; data: PriceComparisonData }
  | { type: 'none'; data: null };

export type IngredientListData = {
  ingredients: {
    code: string;
    name: string;
    localNames: string[];
    cpPercent: number | null;
    tdnPercent: number | null;
    priceTkPerKg: number | null;
    availability: string;
  }[];
};

export type NutrientInfoData = {
  nutrient: string;
  description: string;
  requirement: {
    species: LivestockSpecies;
    stage: ProductionStage;
    minValue: number;
    maxValue?: number;
    unit: string;
  } | null;
  sources: { ingredientName: string; value: number }[];
};

export type ToxicAlertData = {
  alerts: {
    substance: string;
    affectedSpecies: LivestockSpecies[];
    threshold: string;
    symptoms: string[];
    emergencyAction: string;
  }[];
};

export type SeasonalCalendarData = {
  month: number;
  ingredients: {
    code: string;
    name: string;
    availability: 'high' | 'medium' | 'low';
    priceIndex: number;
  }[];
};

export type PriceComparisonData = {
  ingredients: {
    code: string;
    name: string;
    priceTkPerKg: number;
    volatility: string;
    costPerCpUnit: number;
  }[];
};

export type FeedAdvisorSessionData = {
  id: string;
  customerId: string;
  state: FeedAdvisorSessionState;
  livestockContext: LivestockContext | null;
  queryHistory: QueryHistoryItem[];
  lastConfidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QueryHistoryItem = {
  queryText: string;
  intent: FeedAdvisorIntent;
  timestamp: Date;
};

export type IntentClassification = {
  intent: FeedAdvisorIntent;
  confidence: number;
  entities: ExtractedEntities;
};

export type ExtractedEntities = {
  species?: LivestockSpecies;
  productionStage?: ProductionStage;
  ingredients?: string[];
  nutrients?: string[];
  quantity?: number;
  priceLimit?: number;
};

export const FEED_ADVISOR_SAFETY_THRESHOLDS = {
  MIN_CONFIDENCE_FOR_FORMULATION: 0.7,
  MIN_CONFIDENCE_FOR_ADVICE: 0.5,
  ESCALATION_THRESHOLD: 0.4,
  TOXIC_ALERT_PRIORITY: 1.0,
} as const;

export const FEED_ADVISOR_DISCLAIMERS = {
  BN: {
    GENERAL: 'এই পরামর্শ শুধুমাত্র তথ্যমূলক। গুরুতর সমস্যায় পশু চিকিৎসকের সাথে পরামর্শ করুন।',
    FORMULATION: 'খাদ্য মিশ্রণ স্থানীয় পরিস্থিতি অনুযায়ী পরিবর্তন করুন।',
    TOXIC: '⚠️ বিষাক্ততার ঝুঁকি - অবিলম্বে পশু চিকিৎসকের সাথে যোগাযোগ করুন।',
  },
  EN: {
    GENERAL: 'This advice is informational only. Consult a veterinarian for serious issues.',
    FORMULATION: 'Adjust feed mixture based on local conditions.',
    TOXIC: '⚠️ Toxicity risk - contact a veterinarian immediately.',
  },
} as const;
