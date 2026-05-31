import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedAdvisorVreOrchestratorService } from './feed-advisor-vre-orchestrator.service.js';
import type { FeedAdvisorQuery } from './feed-advisor.types.js';

const mockGetPublishedIngredient = vi.fn();
const mockGetIngredientsBySpecies = vi.fn();
const mockListIngredients = vi.fn();
const mockCheckToxicIngredients = vi.fn();
const mockGetSeasonalCalendar = vi.fn();
const mockGetNutrientProfile = vi.fn();
const mockBuildFormulationConstraints = vi.fn();
const mockFormulateRation = vi.fn();
const mockRetrieveKnowledge = vi.fn();
const mockComplete = vi.fn();
const mockLog = vi.fn();

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

vi.mock('../knowledge-retrieval/knowledge-retrieval.service.js', () => ({
  getKnowledgeRetrievalService: () => ({
    retrieveKnowledge: mockRetrieveKnowledge,
  }),
}));

vi.mock('../foundation/ai-foundation.service.js', () => ({
  getAiFoundationService: () => ({
    complete: mockComplete,
  }),
}));

vi.mock('../audit/ai-audit.service.js', () => ({
  getAiAuditService: () => ({
    log: mockLog,
  }),
}));

vi.mock('../disclaimer/ai-disclaimer.resolver.js', () => ({
  resolveAiResponseDisclaimer: vi.fn().mockReturnValue(null),
}));

vi.mock('../knowledge-retrieval/grounding/grounding-engine.js', () => ({
  buildEnrichedPromptContext: vi.fn().mockImplementation(({ userQuery }) => `Context: ${userQuery}`),
}));

vi.mock('../knowledge-retrieval/validation/post-llm-validator.service.js', () => ({
  validateLlmOutput: vi.fn().mockImplementation((content, pack) => ({
    validatedContent: content,
    confidence: pack.confidence,
  })),
}));

describe('FeedAdvisorVreOrchestratorService', () => {
  let service: FeedAdvisorVreOrchestratorService;

  const mockKnowledgePack = {
    chunks: [
      {
        id: 'chunk-1',
        text: 'Test knowledge content',
        confidence: 0.8,
        citationKey: 'VKL:TestSource',
      },
    ],
    confidence: 0.8,
    structuredFacts: [],
    citations: ['VKL:TestSource'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FeedAdvisorVreOrchestratorService();

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
    mockRetrieveKnowledge.mockResolvedValue(mockKnowledgePack);
    mockComplete.mockResolvedValue({ content: 'AI generated response' });
    mockLog.mockResolvedValue(undefined);
  });

  describe('processQuery with VRE Integration', () => {
    it('integrates with VRE for toxic check queries', async () => {
      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'এই খাদ্য বিষাক্ত কিনা?',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(mockRetrieveKnowledge).toHaveBeenCalledWith({
        taskType: 'FEED_FORMULATION',
        retrievalProfileId: 'feed-advisor-v1',
        query: expect.stringContaining('toxic substances'),
        customerId: 'cust-1',
        userId: 'user-1',
        sessionId: response.sessionId,
        locale: 'bn',
      });

      expect(response.intent).toBe('TOXIC_CHECK');
      expect(response.citations.length).toBeGreaterThan(0);
      expect(response.escalationRequired).toBe(true);
    });

    it('uses VRE for ingredient inquiries', async () => {
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

      expect(mockRetrieveKnowledge).toHaveBeenCalledWith({
        taskType: 'FEED_FORMULATION',
        retrievalProfileId: 'feed-advisor-v1',
        query: expect.stringContaining('feed ingredients'),
        customerId: 'system',
        userId: 'system',
        locale: 'bn',
      });

      expect(response.intent).toBe('INGREDIENT_INQUIRY');
      expect(response.citations).toContain('VKL:TestSource');
    });

    it('integrates with AI Foundation Service for LLM responses', async () => {
      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'গরুর জন্য কি খাদ্য ভালো?',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(mockComplete).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'USER',
            content: expect.stringContaining('Context:'),
          }),
        ]),
        feature: 'feed_advisor',
        taskType: 'FEED_FORMULATION',
        customerId: 'system',
        userId: 'system',
      });

      expect(response.responseText).toBe('AI generated response');
    });

    it('logs audit events for feed queries', async () => {
      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'খাদ্য সম্পর্কে পরামর্শ',
        queryLanguage: 'bn',
      };

      await service.processQuery(query);

      expect(mockLog).toHaveBeenCalledWith({
        feature: 'feed_advisor',
        taskType: 'FEED_FORMULATION',
        userId: 'user-1',
        customerId: 'cust-1',
        sessionId: expect.any(String),
        eventType: 'FEED_QUERY_START',
        metadata: {
          queryText: 'খাদ্য সম্পর্কে পরামর্শ',
          queryLanguage: 'bn',
          context: undefined,
        },
      });

      expect(mockLog).toHaveBeenCalledWith({
        feature: 'feed_advisor',
        taskType: 'FEED_FORMULATION',
        userId: 'user-1',
        customerId: 'cust-1',
        sessionId: expect.any(String),
        eventType: 'FEED_QUERY_COMPLETE',
        metadata: expect.any(Object),
      });
    });

    it('handles VRE retrieval failures gracefully for toxic checks', async () => {
      mockRetrieveKnowledge.mockRejectedValue(new Error('VRE failed'));

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'বিষাক্ত খাদ্য পরীক্ষা',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      expect(response.intent).toBe('TOXIC_CHECK');
      expect(response.escalationRequired).toBe(true);
      expect(response.responseText).toContain('⚠️');
      expect(response.confidenceScore).toBe(0);
    });

    it('uses VRE for formulation requests with proper context', async () => {
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
        vklCitations: ['VKL:FormulationTemplate'],
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

      expect(mockRetrieveKnowledge).toHaveBeenCalledWith({
        taskType: 'FEED_FORMULATION',
        retrievalProfileId: 'feed-advisor-v1',
        query: expect.stringContaining('nutrient requirements'),
        species: 'COW',
        customerId: 'cust-1',
        userId: 'user-1',
        sessionId: undefined,
        locale: 'bn',
      });

      expect(response.intent).toBe('FORMULATION_REQUEST');
      expect(response.structuredData?.type).toBe('formulation');
      expect(response.citations).toContain('VKL:TestSource');
      expect(response.citations).toContain('VKL:FormulationTemplate');
    });

    it('handles low confidence VRE results appropriately', async () => {
      mockRetrieveKnowledge.mockResolvedValue({
        ...mockKnowledgePack,
        confidence: 0.3,
      });

      const query: FeedAdvisorQuery = {
        customerId: 'cust-1',
        userId: 'user-1',
        queryText: 'পুষ্টি সম্পর্কে জানতে চাই',
        queryLanguage: 'bn',
      };

      const response = await service.processQuery(query);

      // Should still call LLM but with lower confidence response
      expect(response.confidenceScore).toBeLessThan(0.95);
    });
  });
});