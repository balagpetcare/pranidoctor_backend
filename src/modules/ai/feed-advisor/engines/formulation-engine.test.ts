import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormulationEngineService, getFormulationEngineService } from './formulation-engine.service.js';
import type { FormulationRequestInput } from './formulation-types.js';
import type { FeedIngredientView, NutrientRequirementView } from '../../feed-knowledge/feed-knowledge.types.js';
import type { NutrientProfile } from '../knowledge/nutritional-intelligence.service.js';

const mockGetPublishedIngredient = vi.fn();
const mockGetNutrientProfile = vi.fn();
const mockBuildFormulationConstraints = vi.fn();

vi.mock('../../feed-knowledge/feed-knowledge.service.js', () => ({
  getFeedKnowledgeService: () => ({
    getPublishedIngredient: mockGetPublishedIngredient,
  }),
}));

vi.mock('../knowledge/nutritional-intelligence.service.js', () => ({
  getNutritionalIntelligenceService: () => ({
    getNutrientProfile: mockGetNutrientProfile,
    buildFormulationConstraints: mockBuildFormulationConstraints,
  }),
}));

describe('FormulationEngineService', () => {
  let service: FormulationEngineService;

  const mockProfile: NutrientProfile = {
    dmIntakeKgPerDay: 15,
    dmIntakePercentBw: 3.5,
    targets: [
      { nutrient: 'CP', minValue: 16, maxValue: 18, unit: '% DM', priority: 'critical', source: 'VKL' },
      { nutrient: 'TDN', minValue: 65, unit: '% DM', priority: 'critical', source: 'VKL' },
      { nutrient: 'Ca', minValue: 0.6, unit: '% DM', priority: 'important', source: 'VKL' },
      { nutrient: 'P', minValue: 0.4, unit: '% DM', priority: 'important', source: 'VKL' },
    ],
    adjustments: [],
    confidenceScore: 0.85,
    sourceNotes: 'Test profile',
  };

  const mockMaize: FeedIngredientView = {
    id: 'ing-maize',
    code: 'MAIZE-GRAIN',
    primaryName: 'Maize Grain',
    localNames: ['Bhutta'],
    category: 'CEREAL',
    isActive: true,
    composition: {
      dmPercent: 88,
      cpPercent: 9,
      tdnPercent: 82,
      meMinMjPerKg: 13.5,
      ndfPercent: 12,
      adfPercent: 3,
      cfPercent: 2.5,
      caPercent: 0.05,
      pPercent: 0.3,
    },
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 50, reason: 'Starch limit' },
    ],
    antinutrients: [],
    speciesRestrictions: [],
    seasonalAvailability: [],
    bdAvailability: 'WIDELY_AVAILABLE',
    bdPriceTkPerKg: 35,
    bdPriceVolatility: 'STABLE',
    evidenceGrade: 'B',
    approvedAt: new Date(),
  };

  const mockSoybean: FeedIngredientView = {
    id: 'ing-soy',
    code: 'SOYBEAN-MEAL',
    primaryName: 'Soybean Meal',
    localNames: ['Soyabin Khail'],
    category: 'OILSEED_MEAL',
    isActive: true,
    composition: {
      dmPercent: 90,
      cpPercent: 44,
      tdnPercent: 82,
      meMinMjPerKg: 13.0,
      ndfPercent: 15,
      adfPercent: 8,
      cfPercent: 6,
      caPercent: 0.3,
      pPercent: 0.65,
    },
    maxInclusions: [],
    antinutrients: [],
    speciesRestrictions: [],
    seasonalAvailability: [],
    bdAvailability: 'WIDELY_AVAILABLE',
    bdPriceTkPerKg: 65,
    bdPriceVolatility: 'MODERATE',
    evidenceGrade: 'A',
    approvedAt: new Date(),
  };

  const mockRiceStraw: FeedIngredientView = {
    id: 'ing-straw',
    code: 'RICE-STRAW',
    primaryName: 'Rice Straw',
    localNames: ['Dhan er Khor'],
    category: 'STRAW',
    isActive: true,
    composition: {
      dmPercent: 90,
      cpPercent: 4,
      tdnPercent: 42,
      meMinMjPerKg: 6.0,
      ndfPercent: 72,
      adfPercent: 48,
      cfPercent: 35,
      caPercent: 0.2,
      pPercent: 0.08,
    },
    maxInclusions: [],
    antinutrients: [],
    speciesRestrictions: [],
    seasonalAvailability: [],
    bdAvailability: 'WIDELY_AVAILABLE',
    bdPriceTkPerKg: 5,
    bdPriceVolatility: 'STABLE',
    evidenceGrade: 'B',
    approvedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FormulationEngineService();

    mockGetNutrientProfile.mockResolvedValue(mockProfile);
    mockBuildFormulationConstraints.mockResolvedValue([]);
    mockGetPublishedIngredient.mockImplementation(async (code: string) => {
      if (code === 'MAIZE-GRAIN') return mockMaize;
      if (code === 'SOYBEAN-MEAL') return mockSoybean;
      if (code === 'RICE-STRAW') return mockRiceStraw;
      return null;
    });
  });

  describe('formulateRation', () => {
    it('returns failed solution when no nutrient profile found', async () => {
      mockGetNutrientProfile.mockResolvedValue(null);

      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [{ ingredientCode: 'MAIZE-GRAIN' }],
      };

      const result = await service.formulateRation(request);

      expect(result.status).toBe('FAILED');
      expect(result.warnings.some((w) => w.code === 'NO_PROFILE')).toBe(true);
    });

    it('returns failed solution when no ingredients found', async () => {
      mockGetPublishedIngredient.mockResolvedValue(null);

      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [{ ingredientCode: 'UNKNOWN' }],
      };

      const result = await service.formulateRation(request);

      expect(result.status).toBe('FAILED');
      expect(result.warnings.some((w) => w.code === 'NO_INGREDIENTS')).toBe(true);
    });

    it('formulates ration with available ingredients', async () => {
      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [
          { ingredientCode: 'MAIZE-GRAIN' },
          { ingredientCode: 'SOYBEAN-MEAL' },
          { ingredientCode: 'RICE-STRAW' },
        ],
        budgetConstraints: { targetBatchKg: 100 },
      };

      const result = await service.formulateRation(request);

      if (result.status === 'COMPLETED' && result.optimizedRation) {
        expect(result.optimizedRation.totalKg).toBeCloseTo(100, 0);
        expect(result.optimizedRation.ingredients.length).toBeGreaterThan(0);
        expect(result.optimizedRation.costPerKgTk).toBeGreaterThan(0);
        expect(result.vklCitations.length).toBeGreaterThan(0);
      }
    });

    it('respects forced exclude ingredients', async () => {
      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [
          { ingredientCode: 'MAIZE-GRAIN' },
          { ingredientCode: 'SOYBEAN-MEAL', forcedExclude: true },
          { ingredientCode: 'RICE-STRAW' },
        ],
        budgetConstraints: { targetBatchKg: 100 },
      };

      const result = await service.formulateRation(request);

      if (result.status === 'COMPLETED' && result.optimizedRation) {
        const hasSoybean = result.optimizedRation.ingredients.some(
          (i) => i.ingredientCode === 'SOYBEAN-MEAL',
        );
        expect(hasSoybean).toBe(false);
      }
    });

    it('uses price overrides when provided', async () => {
      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [
          { ingredientCode: 'MAIZE-GRAIN', priceOverrideTkPerKg: 50 },
          { ingredientCode: 'SOYBEAN-MEAL' },
        ],
        budgetConstraints: { targetBatchKg: 100 },
      };

      const result = await service.formulateRation(request);

      expect(result.confidenceScore).toBeGreaterThan(0);
    });

    it('adds warning for species restricted ingredients', async () => {
      const restrictedIngredient: FeedIngredientView = {
        ...mockMaize,
        code: 'RESTRICTED',
        speciesRestrictions: ['COW'],
      };
      mockGetPublishedIngredient.mockImplementation(async (code: string) => {
        if (code === 'RESTRICTED') return restrictedIngredient;
        if (code === 'SOYBEAN-MEAL') return mockSoybean;
        return null;
      });

      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [
          { ingredientCode: 'RESTRICTED' },
          { ingredientCode: 'SOYBEAN-MEAL' },
        ],
      };

      const result = await service.formulateRation(request);

      expect(result.warnings.some((w) => w.code === 'SPECIES_RESTRICTION')).toBe(true);
    });

    it('includes explanations in Bengali and English', async () => {
      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [
          { ingredientCode: 'MAIZE-GRAIN' },
          { ingredientCode: 'SOYBEAN-MEAL' },
        ],
      };

      const result = await service.formulateRation(request);

      expect(result.explanationBn).toBeTruthy();
      expect(result.explanationEn).toBeTruthy();
    });

    it('adds warning when no high-protein sources available', async () => {
      mockGetPublishedIngredient.mockImplementation(async (code: string) => {
        if (code === 'RICE-STRAW') return mockRiceStraw;
        return null;
      });

      const request: FormulationRequestInput = {
        customerId: 'cust-1',
        context: { species: 'COW', productionStage: 'EARLY_LACTATION' },
        availableIngredients: [
          { ingredientCode: 'RICE-STRAW' },
        ],
      };

      const result = await service.formulateRation(request);

      expect(result.warnings.some((w) => w.code === 'LOW_PROTEIN_SOURCES')).toBe(true);
    });
  });
});
