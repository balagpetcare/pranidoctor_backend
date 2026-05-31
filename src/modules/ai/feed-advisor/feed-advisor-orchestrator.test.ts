import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedAdvisorOrchestratorService } from './feed-advisor-orchestrator.service.js';
import type { FeedAdvisorQuery } from './feed-advisor.types.js';

const mockGetPublishedIngredient = vi.fn();
const mockGetIngredientsBySpecies = vi.fn();
const mockListIngredients = vi.fn();
const mockCheckToxicIngredients = vi.fn();
const mockGetSeasonalCalendar = vi.fn();
const mockGetNutrientProfile = vi.fn();
const mockBuildFormulationConstraints = vi.fn();
const mockFormulateRation = vi.fn();

vi.mock('../feed-knowledge/feed-knowledge.service.js', () => ({
  getFeedKnowledgeService: () => ({
    getPublishedIngredient: mockGetPublishedIngredient,
    getIngredientsBySpecies: mockGetIngredientsBySpecies,
    listIngredients: mockListIngredients,
    checkToxicIngredients: mockCheckToxicIngredients,
    getSeasonalCalendar: mockGetSeasonalCalendar,
  }),
}));

vi.mock('./knowledge/nutritional-intelligence.service.js', () => ({
  getNutritionalIntelligenceService: () => ({
    getNutrientProfile: mockGetNutrientProfile,
    buildFormulationConstraints: mockBuildFormulationConstraints,
  }),
}));

vi.mock('./engines/formulation-engine.service.js', () => ({
  getFormulationEngineService: () => ({
    formulateRation: mockFormulateRation,
  }),
}));

describe('FeedAdvisorOrchestratorService', () => {
  let service: FeedAdvisorOrchestratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FeedAdvisorOrchestratorService();

    mockGetIngredientsBySpecies.mockResolvedValue([]);
    mockListIngredients.mockResolvedValue([]);
    mockCheckToxicIngredients.mockResolvedValue([]);
    mockGetSeasonalCalendar.mockResolvedValue([]);
    mockGetNutrientProfile.mockResolvedValue(null);
    mockBuildFormulationConstraints.mockResolvedValue([]);
    mockFormulateRation.mockResolvedValue({
      status: 'COMPLETED',
      optimizedRation: null,
      alternativeRations: [],
      warnings: [],
      vklCitations: [],
      confidenceScore: 0.5,
      explanationBn: 'Test',
      explanationEn: 'Test',
    });
  });

  describe('processQuery', () => {
    it('handles out of scope queries for medical advice', async () => {
      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'গরুর রোগের চিকিৎসা কি?',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('OUT_OF_SCOPE');
      expect(response.escalationRequired).toBe(true);
    });

    it('asks for clarification when species not specified for formulation', async () => {
      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'একটি খাদ্য তালিকা দিন',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('CLARIFICATION_NEEDED');
      expect(response.responseText.length).toBeGreaterThan(0);
    });

    it('handles ingredient inquiry in Bengali', async () => {
      mockListIngredients.mockResolvedValue([
        {
          code: 'MAIZE-GRAIN',
          primaryName: 'Maize Grain',
          localNames: ['Bhutta'],
          composition: { cpPercent: 9, tdnPercent: 82 },
          bdPriceTkPerKg: 35,
          bdAvailability: 'WIDELY_AVAILABLE',
        },
      ]);

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'ভুট্টার পুষ্টিমান কত?',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('INGREDIENT_INQUIRY');
      expect(response.citations).toContain('VKL:FeedIngredient');
    });

    it('handles toxic check with antinutrient warning', async () => {
      mockCheckToxicIngredients.mockResolvedValue([
        {
          substance: 'Gossypol',
          affectedSpecies: ['COW'],
          threshold: '500 mg/kg',
          symptoms: ['Weakness'],
          emergencyAction: 'Reduce feeding',
        },
      ]);

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'এই খাদ্য বিষাক্ত কিনা?',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('TOXIC_CHECK');
      expect(response.disclaimers.length).toBeGreaterThan(0);
    });

    it('handles nutrient inquiry in English', async () => {
      mockListIngredients.mockResolvedValue([
        {
          code: 'SOYBEAN-MEAL',
          primaryName: 'Soybean Meal',
          composition: { cpPercent: 44 },
        },
      ]);

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'What is the protein requirement for dairy cows?',
        queryLanguage: 'en',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('NUTRIENT_INQUIRY');
      expect(response.citations).toContain('VKL:NutrientRequirement');
    });

    it('handles formulation request with species context', async () => {
      mockGetNutrientProfile.mockResolvedValue({
        dmIntakeKgPerDay: 15,
        targets: [],
        adjustments: [],
        confidenceScore: 0.8,
        sourceNotes: 'Test',
      });
      mockGetIngredientsBySpecies.mockResolvedValue([
        { code: 'MAIZE-GRAIN', primaryName: 'Maize' },
      ]);
      mockFormulateRation.mockResolvedValue({
        status: 'COMPLETED',
        optimizedRation: {
          id: 'ration-1',
          ingredients: [
            { ingredientCode: 'MAIZE-GRAIN', ingredientName: 'Maize', percentDm: 50, amountKg: 50 },
          ],
          totalKg: 100,
          costPerKgTk: 40,
          totalCostTk: 4000,
          nutrientComposition: { cpPercent: 14, tdnPercent: 70 },
          nutrientMet: [],
          rationScore: 0.8,
        },
        alternativeRations: [],
        warnings: [],
        vklCitations: ['VKL:FeedIngredient'],
        confidenceScore: 0.85,
        explanationBn: 'খাদ্য তালিকা',
        explanationEn: 'Feed ration',
      });

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'গরুর জন্য খাদ্য তালিকা দিন',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('FORMULATION_REQUEST');
      expect(response.structuredData?.type).toBe('formulation');
      expect(response.confidenceScore).toBeGreaterThan(0);
    });

    it('handles price inquiry', async () => {
      mockListIngredients.mockResolvedValue([
        {
          code: 'MAIZE-GRAIN',
          primaryName: 'Maize Grain',
          composition: { cpPercent: 9 },
          bdPriceTkPerKg: 35,
        },
        {
          code: 'SOYBEAN-MEAL',
          primaryName: 'Soybean Meal',
          composition: { cpPercent: 44 },
          bdPriceTkPerKg: 65,
        },
      ]);

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'খাদ্যের দাম কত?',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('PRICE_INQUIRY');
      expect(response.structuredData?.type).toBe('price_comparison');
    });

    it('includes disclaimers in response', async () => {
      mockListIngredients.mockResolvedValue([]);

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'খাদ্য সম্পর্কে পরামর্শ দিন',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.disclaimers.length).toBeGreaterThan(0);
    });

    it('provides session ID for continuity', async () => {
      const query: FeedAdvisorQuery = {
        sessionId: 'existing-session-123',
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'Hello',
        queryLanguage: 'en',
      };

      const response = await service.processQuery(query);

      expect(response.sessionId).toBe('existing-session-123');
    });

    it('generates new session ID when not provided', async () => {
      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'Hello',
        queryLanguage: 'en',
      };

      const response = await service.processQuery(query);

      expect(response.sessionId).toBeTruthy();
      expect(response.sessionId.length).toBeGreaterThan(0);
    });
  });
});
