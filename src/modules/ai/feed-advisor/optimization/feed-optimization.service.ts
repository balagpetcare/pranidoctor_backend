import { randomUUID } from 'crypto';
import type { LivestockSpecies, ProductionStage } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { getFeedKnowledgeService } from '../../feed-knowledge/feed-knowledge.service.js';
import type {
  FeedPerformanceRecord,
  OutcomeMetrics,
  FarmerFeedback,
  FormulationAnalytics,
  OptimizationRecommendation,
  SubstitutionPattern,
  IngredientPriceUpdate,
  PriceAlert,
  PriceAlertConfig,
  SuggestedChange,
} from './optimization-types.js';

export class FeedOptimizationService {
  private feedKnowledge = getFeedKnowledgeService();

  private performanceRecords: Map<string, FeedPerformanceRecord> = new Map();
  private priceHistory: Map<string, IngredientPriceUpdate[]> = new Map();
  private priceAlertConfigs: Map<string, PriceAlertConfig[]> = new Map();

  async recordFeedingPerformance(
    record: Omit<FeedPerformanceRecord, 'id' | 'createdAt'>,
  ): Promise<FeedPerformanceRecord> {
    const fullRecord: FeedPerformanceRecord = {
      ...record,
      id: randomUUID(),
      createdAt: new Date(),
    };

    this.performanceRecords.set(fullRecord.id, fullRecord);

    return fullRecord;
  }

  async submitFeedback(
    performanceRecordId: string,
    feedback: FarmerFeedback,
  ): Promise<FeedPerformanceRecord | null> {
    const record = this.performanceRecords.get(performanceRecordId);
    if (!record) return null;

    record.feedback = feedback;
    return record;
  }

  async getFormulationAnalytics(formulationId: string): Promise<FormulationAnalytics | null> {
    const records = Array.from(this.performanceRecords.values())
      .filter((r) => r.formulationId === formulationId);

    if (records.length === 0) {
      return {
        formulationId,
        totalUsageCount: 0,
        avgSatisfactionScore: 0,
        avgCostDeviation: 0,
        avgNutrientDeviation: {},
        commonSubstitutions: [],
        performanceByStage: [],
        seasonalVariations: [],
      };
    }

    const satisfactionScores = records
      .filter((r) => r.feedback?.satisfactionScore)
      .map((r) => r.feedback!.satisfactionScore);

    const costDeviations = records.map((r) =>
      ((r.actualCostTk - r.targetCostTk) / r.targetCostTk) * 100,
    );

    const substitutionMap = new Map<string, SubstitutionPattern>();
    for (const record of records) {
      if (record.feedback?.ingredientSubstitutions) {
        for (const sub of record.feedback.ingredientSubstitutions) {
          const key = `${sub.original}:${sub.substitute}`;
          const existing = substitutionMap.get(key);
          if (existing) {
            existing.frequency += 1;
          } else {
            substitutionMap.set(key, {
              originalIngredient: sub.original,
              substituteIngredient: sub.substitute,
              frequency: 1,
              avgCostDelta: 0,
              avgPerformanceDelta: 0,
            });
          }
        }
      }
    }

    const stageMap = new Map<ProductionStage, { count: number; outcomes: number[]; scores: number[] }>();
    for (const record of records) {
      const existing = stageMap.get(record.productionStage) ?? { count: 0, outcomes: [], scores: [] };
      existing.count += 1;
      if (record.outcomeMetrics.milkYieldLiters) {
        existing.outcomes.push(record.outcomeMetrics.milkYieldLiters);
      }
      if (record.feedback?.satisfactionScore) {
        existing.scores.push(record.feedback.satisfactionScore);
      }
      stageMap.set(record.productionStage, existing);
    }

    const performanceByStage = Array.from(stageMap.entries()).map(([stage, data]) => ({
      productionStage: stage,
      usageCount: data.count,
      avgOutcome: data.outcomes.length > 0
        ? data.outcomes.reduce((a, b) => a + b, 0) / data.outcomes.length
        : 0,
      feedbackScore: data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0,
    }));

    return {
      formulationId,
      totalUsageCount: records.length,
      avgSatisfactionScore: satisfactionScores.length > 0
        ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
        : 0,
      avgCostDeviation: costDeviations.reduce((a, b) => a + b, 0) / costDeviations.length,
      avgNutrientDeviation: {},
      commonSubstitutions: Array.from(substitutionMap.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
      performanceByStage,
      seasonalVariations: [],
    };
  }

  async generateOptimizationRecommendations(
    customerId: string,
    species: LivestockSpecies,
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const records = Array.from(this.performanceRecords.values())
      .filter((r) => r.customerId === customerId && r.species === species)
      .slice(-30);

    if (records.length === 0) {
      return recommendations;
    }

    const avgCostDeviation = records.reduce(
      (sum, r) => sum + ((r.actualCostTk - r.targetCostTk) / r.targetCostTk) * 100,
      0,
    ) / records.length;

    if (avgCostDeviation > 10) {
      recommendations.push({
        type: 'cost',
        priority: 'high',
        descriptionBn: 'খরচ লক্ষ্যমাত্রার চেয়ে বেশি। সাশ্রয়ী বিকল্প বিবেচনা করুন।',
        descriptionEn: 'Costs exceeding target. Consider more economical alternatives.',
        suggestedChange: {
          type: 'substitute',
          original: 'SOYBEAN-MEAL',
          replacement: 'MUSTARD-CAKE',
          reason: 'Lower cost per protein unit',
        },
        expectedImpact: {
          costDelta: -8,
          nutritionDelta: { CP: -2 },
          confidenceScore: 0.7,
        },
      });
    }

    const priceAlerts = await this.checkPriceAlerts();
    for (const alert of priceAlerts.filter((a) => a.direction === 'increase' && a.changePercent > 15)) {
      recommendations.push({
        type: 'availability',
        priority: 'medium',
        descriptionBn: `${alert.ingredientName} এর দাম ${alert.changePercent}% বেড়েছে।`,
        descriptionEn: `Price of ${alert.ingredientName} increased by ${alert.changePercent}%.`,
        suggestedChange: {
          type: 'adjust_proportion',
          ingredient: alert.ingredientCode,
          currentPercent: 30,
          suggestedPercent: 20,
        },
        expectedImpact: {
          costDelta: -alert.changePercent * 0.3,
          nutritionDelta: {},
          confidenceScore: 0.65,
        },
      });
    }

    const lowScoreRecords = records.filter(
      (r) => r.feedback?.satisfactionScore && r.feedback.satisfactionScore < 3,
    );

    if (lowScoreRecords.length > records.length * 0.3) {
      const commonIssues = lowScoreRecords
        .flatMap((r) => r.feedback?.issuesReported ?? [])
        .reduce((acc, issue) => {
          acc[issue] = (acc[issue] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const topIssue = Object.entries(commonIssues).sort((a, b) => b[1] - a[1])[0];

      if (topIssue) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          descriptionBn: `সাধারণ সমস্যা: ${topIssue[0]}`,
          descriptionEn: `Common issue: ${topIssue[0]}`,
          suggestedChange: {
            type: 'add_ingredient',
            ingredient: 'MINERAL-MIX',
            suggestedPercent: 2,
            reason: 'Address nutritional deficiency',
          },
          expectedImpact: {
            costDelta: 5,
            nutritionDelta: { Ca: 0.2, P: 0.1 },
            confidenceScore: 0.6,
          },
        });
      }
    }

    return recommendations;
  }

  async updateIngredientPrice(update: IngredientPriceUpdate): Promise<PriceAlert[]> {
    const history = this.priceHistory.get(update.ingredientCode) ?? [];
    history.push(update);
    this.priceHistory.set(update.ingredientCode, history);

    const alerts: PriceAlert[] = [];
    const configs = this.priceAlertConfigs.get(update.ingredientCode) ?? [];

    for (const config of configs) {
      const shouldAlert =
        config.direction === 'both' ||
        (config.direction === 'increase' && update.changePercent > 0) ||
        (config.direction === 'decrease' && update.changePercent < 0);

      if (shouldAlert && Math.abs(update.changePercent) >= config.alertThresholdPercent) {
        const ingredient = await this.feedKnowledge.getPublishedIngredient(update.ingredientCode);

        alerts.push({
          id: randomUUID(),
          ingredientCode: update.ingredientCode,
          ingredientName: ingredient?.primaryName ?? update.ingredientCode,
          previousPrice: update.previousPrice,
          currentPrice: update.newPrice,
          changePercent: update.changePercent,
          direction: update.changePercent > 0 ? 'increase' : 'decrease',
          alertedAt: new Date(),
          suggestedAction: update.changePercent > 0
            ? 'Consider reducing inclusion or finding alternatives'
            : 'Good time to stock up or increase inclusion',
        });
      }
    }

    return alerts;
  }

  async configurePriceAlert(config: PriceAlertConfig): Promise<void> {
    const existing = this.priceAlertConfigs.get(config.ingredientCode) ?? [];
    existing.push(config);
    this.priceAlertConfigs.set(config.ingredientCode, existing);
  }

  async checkPriceAlerts(): Promise<PriceAlert[]> {
    const alerts: PriceAlert[] = [];

    for (const [ingredientCode, history] of this.priceHistory) {
      if (history.length < 2) continue;

      const latest = history[history.length - 1];
      const previous = history[history.length - 2];

      if (Math.abs(latest.changePercent) >= 10) {
        const ingredient = await this.feedKnowledge.getPublishedIngredient(ingredientCode);

        alerts.push({
          id: randomUUID(),
          ingredientCode,
          ingredientName: ingredient?.primaryName ?? ingredientCode,
          previousPrice: previous.newPrice,
          currentPrice: latest.newPrice,
          changePercent: latest.changePercent,
          direction: latest.changePercent > 0 ? 'increase' : 'decrease',
          alertedAt: new Date(),
          suggestedAction: latest.changePercent > 0
            ? 'Review current formulations using this ingredient'
            : 'Consider increasing usage of this ingredient',
        });
      }
    }

    return alerts;
  }

  async calculateFeedCostTrend(
    customerId: string,
    species: LivestockSpecies,
    daysBack: number = 30,
  ): Promise<{ date: Date; avgCostPerKg: number }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const records = Array.from(this.performanceRecords.values())
      .filter(
        (r) =>
          r.customerId === customerId &&
          r.species === species &&
          r.feedingDate >= cutoffDate,
      )
      .sort((a, b) => a.feedingDate.getTime() - b.feedingDate.getTime());

    const dailyMap = new Map<string, { total: number; count: number }>();

    for (const record of records) {
      const dateKey = record.feedingDate.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) ?? { total: 0, count: 0 };
      existing.total += record.actualCostTk / record.actualDmIntakeKg;
      existing.count += 1;
      dailyMap.set(dateKey, existing);
    }

    return Array.from(dailyMap.entries()).map(([dateStr, data]) => ({
      date: new Date(dateStr),
      avgCostPerKg: Math.round((data.total / data.count) * 100) / 100,
    }));
  }

  async getPerformanceSummary(
    customerId: string,
    species: LivestockSpecies,
  ): Promise<{
    totalRecords: number;
    avgSatisfaction: number;
    avgCostEfficiency: number;
    topPerformingFormulations: string[];
    improvementAreas: string[];
  }> {
    const records = Array.from(this.performanceRecords.values())
      .filter((r) => r.customerId === customerId && r.species === species);

    if (records.length === 0) {
      return {
        totalRecords: 0,
        avgSatisfaction: 0,
        avgCostEfficiency: 0,
        topPerformingFormulations: [],
        improvementAreas: [],
      };
    }

    const satisfactionScores = records
      .filter((r) => r.feedback?.satisfactionScore)
      .map((r) => r.feedback!.satisfactionScore);

    const costEfficiencies = records.map(
      (r) => (r.targetCostTk / r.actualCostTk) * 100,
    );

    const formulationScores = new Map<string, number[]>();
    for (const record of records) {
      const scores = formulationScores.get(record.formulationId) ?? [];
      if (record.feedback?.satisfactionScore) {
        scores.push(record.feedback.satisfactionScore);
      }
      formulationScores.set(record.formulationId, scores);
    }

    const topFormulations = Array.from(formulationScores.entries())
      .map(([id, scores]) => ({
        id,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map((f) => f.id);

    const allIssues = records
      .flatMap((r) => r.feedback?.issuesReported ?? [])
      .reduce((acc, issue) => {
        acc[issue] = (acc[issue] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const improvementAreas = Object.entries(allIssues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([issue]) => issue);

    return {
      totalRecords: records.length,
      avgSatisfaction: satisfactionScores.length > 0
        ? Math.round((satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length) * 10) / 10
        : 0,
      avgCostEfficiency: Math.round(
        (costEfficiencies.reduce((a, b) => a + b, 0) / costEfficiencies.length) * 10,
      ) / 10,
      topPerformingFormulations: topFormulations,
      improvementAreas,
    };
  }

  async learnFromSubstitutions(): Promise<SubstitutionPattern[]> {
    const substitutionMap = new Map<string, {
      frequency: number;
      costDeltas: number[];
      outcomes: number[];
    }>();

    for (const record of this.performanceRecords.values()) {
      if (!record.feedback?.ingredientSubstitutions) continue;

      for (const sub of record.feedback.ingredientSubstitutions) {
        const key = `${sub.original}:${sub.substitute}`;
        const existing = substitutionMap.get(key) ?? {
          frequency: 0,
          costDeltas: [],
          outcomes: [],
        };

        existing.frequency += 1;
        existing.costDeltas.push(
          ((record.actualCostTk - record.targetCostTk) / record.targetCostTk) * 100,
        );

        if (record.outcomeMetrics.milkYieldLiters) {
          existing.outcomes.push(record.outcomeMetrics.milkYieldLiters);
        }

        substitutionMap.set(key, existing);
      }
    }

    return Array.from(substitutionMap.entries())
      .filter(([, data]) => data.frequency >= 3)
      .map(([key, data]) => {
        const [original, substitute] = key.split(':');
        return {
          originalIngredient: original,
          substituteIngredient: substitute,
          frequency: data.frequency,
          avgCostDelta: data.costDeltas.length > 0
            ? Math.round((data.costDeltas.reduce((a, b) => a + b, 0) / data.costDeltas.length) * 10) / 10
            : 0,
          avgPerformanceDelta: data.outcomes.length > 0
            ? Math.round((data.outcomes.reduce((a, b) => a + b, 0) / data.outcomes.length) * 10) / 10
            : 0,
        };
      })
      .sort((a, b) => b.frequency - a.frequency);
  }
}

let service: FeedOptimizationService | undefined;

export function getFeedOptimizationService(): FeedOptimizationService {
  if (!service) {
    service = new FeedOptimizationService();
  }
  return service;
}
