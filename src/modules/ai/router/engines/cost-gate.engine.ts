import { getAiCostRateService } from '../../usage/ai-cost-rate.service.js';
import type { ResolvedRoute, RouteHop } from '../../routing/ai-router.types.js';

export type CostEstimateInput = {
  scopeKey: string;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
};

/** Pre-hop budget checks using registry cost rates. */
export class CostGateEngine {
  readonly name = 'CostGateEngine';

  estimateInputTokensFromText(...parts: Array<string | undefined>): number {
    const chars = parts.filter(Boolean).join(' ').length;
    return Math.max(1, Math.ceil(chars / 4));
  }

  async estimateHopCostUsd(
    hop: RouteHop,
    estimate: CostEstimateInput,
  ): Promise<number> {
    return getAiCostRateService().estimateCostUsd(
      hop.providerKey,
      hop.modelKey,
      estimate.estimatedInputTokens,
      estimate.reservedOutputTokens,
      estimate.scopeKey,
    );
  }

  async isWithinRouteBudget(
    route: ResolvedRoute,
    hop: RouteHop,
    estimate: CostEstimateInput,
  ): Promise<{ allowed: boolean; estimatedCostUsd: number }> {
    const estimatedCostUsd = await this.estimateHopCostUsd(hop, estimate);
    if (route.maxCostUsd == null) {
      return { allowed: true, estimatedCostUsd };
    }
    return {
      allowed: estimatedCostUsd <= route.maxCostUsd,
      estimatedCostUsd,
    };
  }
}

let costGateEngine: CostGateEngine | null = null;

export function getCostGateEngine(): CostGateEngine {
  if (!costGateEngine) costGateEngine = new CostGateEngine();
  return costGateEngine;
}

export function resetCostGateEngineForTests(): void {
  costGateEngine = null;
}
