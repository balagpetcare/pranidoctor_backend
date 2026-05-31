import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedKnowledgeService, getFeedKnowledgeService } from './feed-knowledge.service.js';
import type { FeedKnowledgeRepository } from './feed-knowledge.repository.js';
import type { FeedIngredientView, NutrientRequirementView } from './feed-knowledge.types.js';

describe('FeedKnowledgeService', () => {
  let service: FeedKnowledgeService;
  let mockRepository: Partial<FeedKnowledgeRepository>;

  const mockIngredient: FeedIngredientView = {
    id: 'ing-1',
    versionId: 'ver-1',
    ingredientCode: 'RICE_BRAN',
    localNamesBn: ['চালের কুঁড়া', 'কুড়া'],
    localNamesEn: ['Rice Bran'],
    composition: {
      dmPercent: 90,
      cpPercent: 13,
      tdnPercent: 65,
      ndfPercent: 25,
      meValueMjPerKg: 11.5,
    },
    bdAvailability: 'WIDELY_AVAILABLE',
    seasonality: [],
    avgPriceBdtPerKg: 25,
    priceVolatility: 'MODERATE',
    speciesRestrictions: [],
    antinutrients: [],
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 30, reason: 'Fat content' },
    ],
    feedItemId: null,
    status: 'PUBLISHED',
    evidenceLevel: 'L2',
    confidenceScore: 0.85,
  };

  const mockRequirement: NutrientRequirementView = {
    id: 'req-1',
    versionId: 'ver-2',
    species: 'COW',
    productionStage: 'EARLY_LACTATION',
    breedCategory: null,
    weightRange: { minKg: 300, maxKg: 500 },
    dmIntake: { kgPerDay: 15, percentBw: 3.5 },
    cpPercent: { min: 16, max: 18 },
    tdnPercentMin: 70,
    meMinMjPerKg: 10.5,
    ndfPercentMax: 35,
    caPercentMin: 0.7,
    pPercentMin: 0.45,
    productionTargets: { milkYieldLiters: 15, adgKg: null },
    status: 'PUBLISHED',
  };

  beforeEach(() => {
    mockRepository = {
      listFeedIngredients: vi.fn().mockResolvedValue([mockIngredient]),
      searchFeedIngredients: vi.fn().mockResolvedValue([mockIngredient]),
      getFeedIngredientByCode: vi.fn().mockResolvedValue(mockIngredient),
      listNutrientRequirements: vi.fn().mockResolvedValue([mockRequirement]),
      getNutrientRequirement: vi.fn().mockResolvedValue(mockRequirement),
      checkToxicIngredients: vi.fn().mockResolvedValue([]),
      listToxicFeedAlerts: vi.fn().mockResolvedValue([]),
      getGraphEdges: vi.fn().mockResolvedValue([]),
      expandGraphFromEntity: vi.fn().mockResolvedValue([]),
      createGraphEdge: vi.fn().mockResolvedValue('edge-1'),
    };
    service = new FeedKnowledgeService(mockRepository as FeedKnowledgeRepository);
  });

  describe('listIngredients', () => {
    it('should list published ingredients', async () => {
      const result = await service.listIngredients({ status: 'PUBLISHED' });
      expect(result).toHaveLength(1);
      expect(result[0]?.ingredientCode).toBe('RICE_BRAN');
    });

    it('should search ingredients by query', async () => {
      const result = await service.listIngredients({ query: 'চালের' });
      expect(mockRepository.searchFeedIngredients).toHaveBeenCalledWith({
        query: 'চালের',
        status: undefined,
        limit: undefined,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getIngredientByCode', () => {
    it('should return ingredient by code', async () => {
      const result = await service.getIngredientByCode('RICE_BRAN');
      expect(result).toBeDefined();
      expect(result?.ingredientCode).toBe('RICE_BRAN');
    });
  });

  describe('getNutrientRequirements', () => {
    it('should return nutrient requirements for species and stage', async () => {
      const result = await service.getNutrientRequirements({
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
      });
      expect(result).toBeDefined();
      expect(result?.cpPercent.min).toBe(16);
    });
  });

  describe('checkToxicIngredients', () => {
    it('should return PROCEED for non-toxic ingredients', async () => {
      const result = await service.checkToxicIngredients(['RICE_BRAN', 'WHEAT_BRAN']);
      expect(result.hasToxicAlert).toBe(false);
      expect(result.recommendedAction).toBe('PROCEED');
    });

    it('should return BLOCK for toxic ingredients', async () => {
      const mockToxicAlert = {
        id: 'toxic-1',
        versionId: 'ver-3',
        substance: 'Gossypol',
        commonNamesBn: ['গসিপল'],
        commonNamesEn: ['Gossypol'],
        speciesAffected: ['COW' as const],
        toxicThreshold: '> 500 ppm',
        lethalThreshold: '> 1000 ppm',
        clinicalSignsBn: ['শ্বাসকষ্ট'],
        clinicalSignsEn: ['Respiratory distress'],
        onsetTime: '2-4 hours',
        immediateActionBn: 'পশু চিকিৎসক কল করুন',
        immediateActionEn: 'Call veterinarian',
        vetRequired: true,
        relatedIngredientCodes: ['COTTONSEED_MEAL'],
        status: 'PUBLISHED' as const,
      };

      mockRepository.checkToxicIngredients = vi.fn().mockResolvedValue([mockToxicAlert]);
      service = new FeedKnowledgeService(mockRepository as FeedKnowledgeRepository);

      const result = await service.checkToxicIngredients(['COTTONSEED_MEAL']);
      expect(result.hasToxicAlert).toBe(true);
      expect(result.recommendedAction).toBe('BLOCK');
      expect(result.ingredientsWithAlerts).toContain('COTTONSEED_MEAL');
    });
  });

  describe('buildStructuredFacts', () => {
    it('should build structured facts for formulation', async () => {
      const result = await service.buildStructuredFacts({
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        ingredientCodes: ['RICE_BRAN'],
      });

      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.coverage).toBeGreaterThan(0);

      const cpFact = result.facts.find((f) => f.factType === 'NUTRIENT_CP_PERCENT');
      expect(cpFact).toBeDefined();
      expect(cpFact?.value).toBe(16);
    });
  });
});

describe('FeedKnowledgeService instantiation', () => {
  it('should accept injected repository', () => {
    const mockRepo = {} as FeedKnowledgeRepository;
    const service1 = new FeedKnowledgeService(mockRepo);
    expect(service1).toBeDefined();
  });
});
