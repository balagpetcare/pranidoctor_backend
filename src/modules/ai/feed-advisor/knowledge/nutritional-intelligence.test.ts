import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NutritionalIntelligenceService, type LivestockContext } from './nutritional-intelligence.service.js';
import type { FeedIngredientView, NutrientRequirementView } from '../../feed-knowledge/feed-knowledge.types.js';

const mockGetNutrientRequirements = vi.fn();
const mockGetIngredientsBySpecies = vi.fn();
const mockGetPublishedIngredient = vi.fn();

vi.mock('../../feed-knowledge/feed-knowledge.service.js', () => ({
  getFeedKnowledgeService: () => ({
    getNutrientRequirements: mockGetNutrientRequirements,
    getIngredientsBySpecies: mockGetIngredientsBySpecies,
    getPublishedIngredient: mockGetPublishedIngredient,
  }),
}));

describe('NutritionalIntelligenceService', () => {
  let service: NutritionalIntelligenceService;

  const mockRequirement: NutrientRequirementView = {
    id: 'req-1',
    species: 'COW',
    productionStage: 'EARLY_LACTATION',
    breedCategory: 'CROSSBRED',
    weightRange: { minKg: 400, maxKg: 500 },
    dmIntake: { kgPerDay: 15, percentBw: 3.5 },
    cpPercent: { min: 16, max: 18 },
    tdnPercentMin: 68,
    meMinMjPerKg: 10.5,
    ndfPercentMax: 40,
    caPercentMin: 0.7,
    pPercentMin: 0.4,
    productionTargets: { milkYieldLiters: 12, adgKg: null },
    sourceDocuments: ['ICAR-2023'],
    approvedAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NutritionalIntelligenceService();
    mockGetNutrientRequirements.mockResolvedValue(mockRequirement);
  });

  describe('getNutrientProfile', () => {
    it('returns null when no requirement found', async () => {
      mockGetNutrientRequirements.mockResolvedValue(null);

      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      };

      const result = await service.getNutrientProfile(context);
      expect(result).toBeNull();
    });

    it('builds nutrient targets from requirement', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        weightKg: 450,
        milkYieldLitersPerDay: 12,
      };

      const result = await service.getNutrientProfile(context);

      expect(result).not.toBeNull();
      expect(result!.targets.length).toBeGreaterThan(0);

      const cpTarget = result!.targets.find((t) => t.nutrient === 'CP');
      expect(cpTarget).toBeDefined();
      expect(cpTarget!.priority).toBe('critical');
    });

    it('applies milk yield adjustments', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        weightKg: 450,
        milkYieldLitersPerDay: 18,
      };

      const result = await service.getNutrientProfile(context);

      expect(result).not.toBeNull();
      expect(result!.adjustments.length).toBeGreaterThan(0);
      expect(result!.adjustments.some((a) => a.reason.includes('Milk yield'))).toBe(true);
    });

    it('applies late pregnancy adjustments', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'LATE_PREGNANT',
        isPregnant: true,
        gestationWeek: 36,
      };

      const result = await service.getNutrientProfile(context);

      expect(result).not.toBeNull();
      expect(result!.adjustments.some((a) => a.reason.includes('Late pregnancy'))).toBe(true);
    });

    it('applies breed-specific adjustments for local desi', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'MAINTENANCE',
        breedCategory: 'LOCAL_DESI',
      };

      const reqWithoutBreed = { ...mockRequirement, breedCategory: null };
      mockGetNutrientRequirements.mockResolvedValue(reqWithoutBreed);

      const result = await service.getNutrientProfile(context);

      expect(result).not.toBeNull();
      expect(result!.adjustments.some((a) => a.reason.includes('Local desi'))).toBe(true);
    });

    it('calculates DM intake based on body weight', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        weightKg: 550,
      };

      const result = await service.getNutrientProfile(context);

      expect(result).not.toBeNull();
      expect(result!.dmIntakeKgPerDay).toBeGreaterThan(15);
    });
  });

  describe('matchIngredients', () => {
    const mockIngredient: FeedIngredientView = {
      id: 'ing-1',
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
        {
          species: 'COW',
          productionStage: 'EARLY_LACTATION',
          maxPercentDm: 50,
          reason: 'Starch limit',
        },
      ],
      antinutrients: [],
      speciesRestrictions: [],
      seasonalAvailability: [],
      bdAvailability: 'WIDELY_AVAILABLE',
      bdPriceTkPerKg: 35,
      bdPriceVolatility: 'STABLE',
      evidenceGrade: 'B',
      approvedAt: new Date('2025-01-01'),
    };

    beforeEach(() => {
      mockGetIngredientsBySpecies.mockResolvedValue([mockIngredient]);
      mockGetPublishedIngredient.mockResolvedValue(mockIngredient);
    });

    it('filters out ingredients with species restrictions', async () => {
      const restrictedIngredient: FeedIngredientView = {
        ...mockIngredient,
        id: 'ing-2',
        code: 'RESTRICTED',
        speciesRestrictions: ['COW'],
      };
      mockGetIngredientsBySpecies.mockResolvedValue([mockIngredient, restrictedIngredient]);

      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      };

      const matches = await service.matchIngredients(context);

      expect(matches.length).toBe(1);
      expect(matches[0].ingredient.code).toBe('MAIZE-GRAIN');
    });

    it('scores widely available ingredients higher', async () => {
      const rareIngredient: FeedIngredientView = {
        ...mockIngredient,
        id: 'ing-3',
        code: 'RARE',
        bdAvailability: 'RARELY_AVAILABLE',
      };
      mockGetIngredientsBySpecies.mockResolvedValue([mockIngredient, rareIngredient]);

      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      };

      const matches = await service.matchIngredients(context);

      const maizeMatch = matches.find((m) => m.ingredient.code === 'MAIZE-GRAIN');
      const rareMatch = matches.find((m) => m.ingredient.code === 'RARE');

      expect(maizeMatch!.matchScore).toBeGreaterThan(rareMatch!.matchScore);
    });

    it('includes max inclusion percentage when available', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      };

      const matches = await service.matchIngredients(context);

      expect(matches[0].maxInclusionPercent).toBe(50);
    });
  });

  describe('buildFormulationConstraints', () => {
    const mockIngredientWithLimits: FeedIngredientView = {
      id: 'ing-1',
      code: 'COTTONSEED-CAKE',
      primaryName: 'Cottonseed Cake',
      localNames: [],
      category: 'OILSEED_MEAL',
      isActive: true,
      composition: {
        dmPercent: 92,
        cpPercent: 40,
        tdnPercent: 75,
        meMinMjPerKg: 11,
        ndfPercent: 35,
        adfPercent: 28,
        cfPercent: 15,
        caPercent: 0.2,
        pPercent: 1.0,
      },
      maxInclusions: [
        {
          species: 'COW',
          productionStage: 'EARLY_LACTATION',
          maxPercentDm: 15,
          reason: 'Gossypol toxicity risk',
        },
      ],
      antinutrients: [
        {
          compound: 'Gossypol',
          levelMgPerKg: 500,
          mitigation: 'Limit inclusion to 15%',
        },
      ],
      speciesRestrictions: [],
      seasonalAvailability: [],
      bdAvailability: 'SEASONALLY_AVAILABLE',
      bdPriceTkPerKg: 45,
      bdPriceVolatility: 'MODERATE',
      evidenceGrade: 'B',
      approvedAt: new Date('2025-01-01'),
    };

    beforeEach(() => {
      mockGetPublishedIngredient.mockResolvedValue(mockIngredientWithLimits);
    });

    it('creates max constraints from inclusion limits', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      };

      const constraints = await service.buildFormulationConstraints(context, ['COTTONSEED-CAKE']);

      expect(constraints.length).toBeGreaterThan(0);
      expect(constraints.some((c) => c.constraintType === 'max' && c.value === 15)).toBe(true);
    });

    it('adds constraints for antinutrient mitigation', async () => {
      const context: LivestockContext = {
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      };

      const constraints = await service.buildFormulationConstraints(context, ['COTTONSEED-CAKE']);

      expect(constraints.some((c) => c.reason.includes('Antinutrient'))).toBe(true);
    });
  });

  describe('inferProductionStage', () => {
    it('infers early lactation for high-yielding dairy cows', () => {
      const stage = service.inferProductionStage({
        species: 'COW',
        ageMonths: 36,
        isLactating: true,
        milkYieldLiters: 15,
      });

      expect(stage).toBe('EARLY_LACTATION');
    });

    it('infers late lactation for lower-yielding dairy cows', () => {
      const stage = service.inferProductionStage({
        species: 'COW',
        ageMonths: 36,
        isLactating: true,
        milkYieldLiters: 4,
      });

      expect(stage).toBe('LATE_LACTATION');
    });

    it('infers starter for young poultry', () => {
      const stage = service.inferProductionStage({
        species: 'CHICKEN',
        ageMonths: 0.5,
      });

      expect(stage).toBe('STARTER');
    });

    it('infers laying for mature poultry', () => {
      const stage = service.inferProductionStage({
        species: 'CHICKEN',
        ageMonths: 6,
        isLactating: true,
      });

      expect(stage).toBe('LAYING');
    });

    it('infers late pregnant for late gestation', () => {
      const stage = service.inferProductionStage({
        species: 'COW',
        ageMonths: 48,
        isPregnant: true,
        gestationWeek: 38,
      });

      expect(stage).toBe('LATE_PREGNANT');
    });

    it('infers calf pre-weaning for young calves', () => {
      const stage = service.inferProductionStage({
        species: 'COW',
        ageMonths: 1,
      });

      expect(stage).toBe('CALF_PRE_WEANING');
    });

    it('defaults to maintenance for adult animals', () => {
      const stage = service.inferProductionStage({
        species: 'COW',
        ageMonths: 36,
      });

      expect(stage).toBe('MAINTENANCE');
    });
  });
});
