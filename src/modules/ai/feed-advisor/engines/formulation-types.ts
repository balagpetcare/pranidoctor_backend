import type {
  BreedCategory,
  FormulationStatus,
  LivestockSpecies,
  ProductionStage,
} from '../../../../generated/prisma/index.js';
import type { FeedIngredientView, NutrientRequirementView } from '../../feed-knowledge/feed-knowledge.types.js';
import type { NutrientProfile, FormulationConstraint, LivestockContext } from '../knowledge/nutritional-intelligence.service.js';

export type FormulationRequestInput = {
  customerId: string;
  livestockId?: string;
  context: LivestockContext;
  availableIngredients: IngredientAvailability[];
  budgetConstraints?: BudgetConstraints;
  preferences?: FormulationPreferences;
};

export type IngredientAvailability = {
  ingredientCode: string;
  availableKg?: number;
  priceOverrideTkPerKg?: number;
  forcedInclude?: boolean;
  forcedExclude?: boolean;
};

export type BudgetConstraints = {
  maxCostPerKgTk?: number;
  totalBudgetTk?: number;
  targetBatchKg?: number;
};

export type FormulationPreferences = {
  prioritizeCost?: boolean;
  prioritizeLocalIngredients?: boolean;
  avoidHighVolatilityPricing?: boolean;
  roughageConcentrateRatio?: { roughagePercent: number; concentratePercent: number };
};

export type FormulationSolution = {
  status: FormulationStatus;
  optimizedRation: OptimizedRation | null;
  alternativeRations: OptimizedRation[];
  warnings: FormulationWarning[];
  vklCitations: string[];
  confidenceScore: number;
  explanationBn: string;
  explanationEn: string;
};

export type OptimizedRation = {
  id: string;
  ingredients: RationComponent[];
  totalKg: number;
  costPerKgTk: number;
  totalCostTk: number;
  nutrientComposition: NutrientComposition;
  nutrientMet: NutrientMetStatus[];
  rationScore: number;
};

export type RationComponent = {
  ingredientCode: string;
  ingredientName: string;
  amountKg: number;
  percentDm: number;
  costTk: number;
  isRoughage: boolean;
  evidenceGrade: string;
};

export type NutrientComposition = {
  dmPercent: number;
  cpPercent: number;
  tdnPercent: number;
  meMjPerKg: number;
  ndfPercent: number;
  caPercent: number;
  pPercent: number;
  cfPercent: number;
};

export type NutrientMetStatus = {
  nutrient: string;
  target: number;
  achieved: number;
  unit: string;
  metStatus: 'exceeded' | 'met' | 'below_min' | 'above_max';
  deviation: number;
};

export type FormulationWarning = {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  messageBn: string;
  messageEn: string;
  relatedIngredients?: string[];
};

export type FormulationContext = {
  request: FormulationRequestInput;
  profile: NutrientProfile;
  ingredients: Map<string, FormulationIngredient>;
  constraints: FormulationConstraint[];
  objectives: FormulationObjective[];
};

export type FormulationIngredient = {
  code: string;
  name: string;
  view: FeedIngredientView;
  pricePerKg: number;
  availableKg: number | null;
  isRoughage: boolean;
  minInclusionPercent: number;
  maxInclusionPercent: number;
  forcedInclude: boolean;
  forcedExclude: boolean;
};

export type FormulationObjective = {
  type: 'minimize_cost' | 'maximize_nutrient' | 'balance';
  weight: number;
};

export type LpVariable = {
  name: string;
  lowerBound: number;
  upperBound: number;
  coefficient: number;
};

export type LpConstraint = {
  name: string;
  variables: { name: string; coefficient: number }[];
  relation: 'le' | 'ge' | 'eq';
  rhs: number;
};

export type LpProblem = {
  objective: 'minimize' | 'maximize';
  variables: LpVariable[];
  constraints: LpConstraint[];
};

export type LpSolution = {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  objectiveValue: number;
  variables: Map<string, number>;
  dualValues?: Map<string, number>;
};
