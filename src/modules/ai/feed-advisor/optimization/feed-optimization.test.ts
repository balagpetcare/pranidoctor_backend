import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedOptimizationService } from './feed-optimization.service.js';
import type { FeedPerformanceRecord, FarmerFeedback } from './optimization-types.js';

const mockGetPublishedIngredient = vi.fn();

vi.mock('../../feed-knowledge/feed-knowledge.service.js', () => ({
  getFeedKnowledgeService: () => ({
    getPublishedIngredient: mockGetPublishedIngredient,
  }),
}));

describe('FeedOptimizationService', () => {
  let service: FeedOptimizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FeedOptimizationService();
    mockGetPublishedIngredient.mockResolvedValue({
      primaryName: 'Test Ingredient',
    });
  });

  describe('recordFeedingPerformance', () => {
    it('creates performance record with generated ID', async () => {
      const record = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 600,
        targetCostTk: 550,
        outcomeMetrics: { milkYieldLiters: 12 },
      });

      expect(record.id).toBeTruthy();
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.actualDmIntakeKg).toBe(15);
    });
  });

  describe('submitFeedback', () => {
    it('attaches feedback to existing record', async () => {
      const record = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 600,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      const feedback: FarmerFeedback = {
        satisfactionScore: 4,
        comments: 'Good results',
      };

      const updated = await service.submitFeedback(record.id, feedback);

      expect(updated?.feedback?.satisfactionScore).toBe(4);
      expect(updated?.feedback?.comments).toBe('Good results');
    });

    it('returns null for non-existent record', async () => {
      const result = await service.submitFeedback('non-existent', {
        satisfactionScore: 3,
      });

      expect(result).toBeNull();
    });
  });

  describe('getFormulationAnalytics', () => {
    it('returns empty analytics for unused formulation', async () => {
      const analytics = await service.getFormulationAnalytics('unused-formula');

      expect(analytics?.totalUsageCount).toBe(0);
      expect(analytics?.avgSatisfactionScore).toBe(0);
    });

    it('calculates analytics from multiple records', async () => {
      await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 600,
        targetCostTk: 550,
        outcomeMetrics: { milkYieldLiters: 12 },
      });

      const record2 = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-2',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'MID_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 14,
        targetDmIntakeKg: 14,
        actualCostTk: 550,
        targetCostTk: 550,
        outcomeMetrics: { milkYieldLiters: 10 },
      });

      await service.submitFeedback(record2.id, { satisfactionScore: 5 });

      const analytics = await service.getFormulationAnalytics('formula-1');

      expect(analytics?.totalUsageCount).toBe(2);
      expect(analytics?.avgSatisfactionScore).toBe(5);
    });

    it('tracks substitution patterns', async () => {
      const record = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 600,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      await service.submitFeedback(record.id, {
        satisfactionScore: 4,
        ingredientSubstitutions: [
          { original: 'SOYBEAN-MEAL', substitute: 'MUSTARD-CAKE', reason: 'Cost' },
        ],
      });

      const analytics = await service.getFormulationAnalytics('formula-1');

      expect(analytics?.commonSubstitutions.length).toBe(1);
      expect(analytics?.commonSubstitutions[0].originalIngredient).toBe('SOYBEAN-MEAL');
    });
  });

  describe('generateOptimizationRecommendations', () => {
    it('returns empty array when no records exist', async () => {
      const recommendations = await service.generateOptimizationRecommendations(
        'cust-1',
        'COW',
      );

      expect(recommendations).toHaveLength(0);
    });

    it('generates cost recommendation when costs exceed target', async () => {
      for (let i = 0; i < 5; i++) {
        await service.recordFeedingPerformance({
          customerId: 'cust-1',
          livestockId: `livestock-${i}`,
          formulationId: 'formula-1',
          species: 'COW',
          productionStage: 'EARLY_LACTATION',
          feedingDate: new Date(),
          actualDmIntakeKg: 15,
          targetDmIntakeKg: 14,
          actualCostTk: 700,
          targetCostTk: 550,
          outcomeMetrics: {},
        });
      }

      const recommendations = await service.generateOptimizationRecommendations(
        'cust-1',
        'COW',
      );

      expect(recommendations.some((r) => r.type === 'cost')).toBe(true);
    });

    it('generates recommendation for low satisfaction scores', async () => {
      for (let i = 0; i < 5; i++) {
        const record = await service.recordFeedingPerformance({
          customerId: 'cust-1',
          livestockId: `livestock-${i}`,
          formulationId: 'formula-1',
          species: 'COW',
          productionStage: 'EARLY_LACTATION',
          feedingDate: new Date(),
          actualDmIntakeKg: 15,
          targetDmIntakeKg: 14,
          actualCostTk: 550,
          targetCostTk: 550,
          outcomeMetrics: {},
        });

        await service.submitFeedback(record.id, {
          satisfactionScore: 2,
          issuesReported: ['Low milk production'],
        });
      }

      const recommendations = await service.generateOptimizationRecommendations(
        'cust-1',
        'COW',
      );

      expect(recommendations.some((r) => r.type === 'performance')).toBe(true);
    });
  });

  describe('updateIngredientPrice', () => {
    it('triggers alert when price exceeds threshold', async () => {
      await service.configurePriceAlert({
        ingredientCode: 'MAIZE-GRAIN',
        alertThresholdPercent: 10,
        direction: 'both',
        notifyCustomerIds: ['cust-1'],
      });

      const alerts = await service.updateIngredientPrice({
        ingredientCode: 'MAIZE-GRAIN',
        previousPrice: 35,
        newPrice: 42,
        changePercent: 20,
        effectiveDate: new Date(),
        source: 'Market survey',
      });

      expect(alerts.length).toBe(1);
      expect(alerts[0].direction).toBe('increase');
      expect(alerts[0].changePercent).toBe(20);
    });

    it('respects direction filter in alert config', async () => {
      await service.configurePriceAlert({
        ingredientCode: 'MAIZE-GRAIN',
        alertThresholdPercent: 10,
        direction: 'decrease',
        notifyCustomerIds: ['cust-1'],
      });

      const alerts = await service.updateIngredientPrice({
        ingredientCode: 'MAIZE-GRAIN',
        previousPrice: 35,
        newPrice: 42,
        changePercent: 20,
        effectiveDate: new Date(),
        source: 'Market survey',
      });

      expect(alerts.length).toBe(0);
    });
  });

  describe('calculateFeedCostTrend', () => {
    it('returns empty array when no records exist', async () => {
      const trend = await service.calculateFeedCostTrend('cust-1', 'COW', 30);

      expect(trend).toHaveLength(0);
    });

    it('calculates daily average costs', async () => {
      const today = new Date();

      await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: today,
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 600,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-2',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: today,
        actualDmIntakeKg: 14,
        targetDmIntakeKg: 14,
        actualCostTk: 560,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      const trend = await service.calculateFeedCostTrend('cust-1', 'COW', 30);

      expect(trend.length).toBe(1);
      expect(trend[0].avgCostPerKg).toBeGreaterThan(0);
    });
  });

  describe('getPerformanceSummary', () => {
    it('returns zero values when no records exist', async () => {
      const summary = await service.getPerformanceSummary('cust-1', 'COW');

      expect(summary.totalRecords).toBe(0);
      expect(summary.avgSatisfaction).toBe(0);
    });

    it('calculates performance metrics from records', async () => {
      const record1 = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 550,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      await service.submitFeedback(record1.id, {
        satisfactionScore: 5,
        issuesReported: [],
      });

      const record2 = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-2',
        formulationId: 'formula-2',
        species: 'COW',
        productionStage: 'MID_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 14,
        targetDmIntakeKg: 14,
        actualCostTk: 600,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      await service.submitFeedback(record2.id, {
        satisfactionScore: 3,
        issuesReported: ['Palatability issue'],
      });

      const summary = await service.getPerformanceSummary('cust-1', 'COW');

      expect(summary.totalRecords).toBe(2);
      expect(summary.avgSatisfaction).toBe(4);
      expect(summary.improvementAreas).toContain('Palatability issue');
    });
  });

  describe('learnFromSubstitutions', () => {
    it('identifies common substitution patterns', async () => {
      for (let i = 0; i < 5; i++) {
        const record = await service.recordFeedingPerformance({
          customerId: 'cust-1',
          livestockId: `livestock-${i}`,
          formulationId: 'formula-1',
          species: 'COW',
          productionStage: 'EARLY_LACTATION',
          feedingDate: new Date(),
          actualDmIntakeKg: 15,
          targetDmIntakeKg: 14,
          actualCostTk: 500,
          targetCostTk: 550,
          outcomeMetrics: { milkYieldLiters: 12 },
        });

        await service.submitFeedback(record.id, {
          satisfactionScore: 4,
          ingredientSubstitutions: [
            { original: 'SOYBEAN-MEAL', substitute: 'MUSTARD-CAKE', reason: 'Cost' },
          ],
        });
      }

      const patterns = await service.learnFromSubstitutions();

      expect(patterns.length).toBe(1);
      expect(patterns[0].originalIngredient).toBe('SOYBEAN-MEAL');
      expect(patterns[0].substituteIngredient).toBe('MUSTARD-CAKE');
      expect(patterns[0].frequency).toBe(5);
    });

    it('filters out infrequent substitutions', async () => {
      const record = await service.recordFeedingPerformance({
        customerId: 'cust-1',
        livestockId: 'livestock-1',
        formulationId: 'formula-1',
        species: 'COW',
        productionStage: 'EARLY_LACTATION',
        feedingDate: new Date(),
        actualDmIntakeKg: 15,
        targetDmIntakeKg: 14,
        actualCostTk: 550,
        targetCostTk: 550,
        outcomeMetrics: {},
      });

      await service.submitFeedback(record.id, {
        satisfactionScore: 4,
        ingredientSubstitutions: [
          { original: 'RARE-INGREDIENT', substitute: 'COMMON-INGREDIENT', reason: 'Test' },
        ],
      });

      const patterns = await service.learnFromSubstitutions();

      expect(patterns.length).toBe(0);
    });
  });
});
