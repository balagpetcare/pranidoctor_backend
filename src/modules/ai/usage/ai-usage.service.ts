import { getPrisma } from '../../../shared/database/prisma.js';

export class AiUsageService {
  readonly name = 'AiUsageService';

  async record(params: {
    userId?: string;
    customerId?: string;
    feature: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    success: boolean;
  }): Promise<void> {
    const costUsd = this.estimateCost(params.provider, params.inputTokens, params.outputTokens);
    await getPrisma().aiUsageRecord.create({
      data: {
        userId: params.userId,
        customerId: params.customerId,
        feature: params.feature,
        provider: params.provider,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        costUsd,
        latencyMs: params.latencyMs,
        success: params.success,
      },
    });
  }

  private estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
    if (provider === 'openai') {
      return (inputTokens * 0.00000015 + outputTokens * 0.0000006);
    }
    if (provider === 'anthropic') {
      return (inputTokens * 0.00000025 + outputTokens * 0.00000125);
    }
    return 0;
  }

  async getUsageSummary(since: Date) {
    const rows = await getPrisma().aiUsageRecord.groupBy({
      by: ['feature', 'provider'],
      where: { createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _count: { id: true },
    });

    const total = await getPrisma().aiUsageRecord.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _count: { id: true },
    });

    return { since: since.toISOString(), byFeature: rows, total };
  }
}

let service: AiUsageService | null = null;

export function getAiUsageService(): AiUsageService {
  if (!service) service = new AiUsageService();
  return service;
}
