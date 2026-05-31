import { getLogger } from '../../../shared/logger/logger.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import { getAiModelRepository, getAiProviderRepository } from '../repositories/ai-platform.repository.js';

import {
  estimateAiCostUsdLegacy,
  registerModelRates,
  type AiTokenRates,
} from './ai-usage.cost.js';

const rateCache = new Map<string, AiTokenRates>();
let bootstrapped = false;

function cacheKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}:${model.trim()}`;
}

function normalizeProviderKey(provider: string): string {
  return provider.replace(/-/g, '_').trim().toLowerCase();
}

export class AiCostRateService {
  readonly name = 'AiCostRateService';

  async bootstrapFromDatabase(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<number> {
    const rows = await getAiModelRepository().listRatesForScope(scopeKey);
    let count = 0;

    for (const row of rows) {
      const provider = await getAiProviderRepository().findById(row.providerId);
      if (!provider) continue;
      const rates: AiTokenRates = {
        inputPerToken: Number(row.inputCostPerToken),
        outputPerToken: Number(row.outputCostPerToken),
      };
      registerModelRates(provider.providerKey, row.modelKey, rates);
      registerModelRates(normalizeProviderKey(provider.providerKey), row.modelKey, rates);
      rateCache.set(cacheKey(provider.providerKey, row.modelKey), rates);
      count += 1;
    }

    bootstrapped = true;
    getLogger().info({ scopeKey, modelRates: count }, 'AI cost rates bootstrapped from database');
    return count;
  }

  async ensureBootstrapped(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<void> {
    if (bootstrapped && rateCache.size > 0) return;
    try {
      await this.bootstrapFromDatabase(scopeKey);
    } catch (err) {
      getLogger().warn({ err }, 'Failed to bootstrap AI cost rates from database');
    }
  }

  async estimateCostUsd(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    scopeKey: string = PLATFORM_SCOPE_KEY,
  ): Promise<number> {
    await this.ensureBootstrapped(scopeKey);

    const normalized = normalizeProviderKey(provider);
    const cached = rateCache.get(cacheKey(normalized, model)) ?? rateCache.get(cacheKey(provider, model));
    if (cached) {
      return inputTokens * cached.inputPerToken + outputTokens * cached.outputPerToken;
    }

    const row = await getAiModelRepository().findRate(scopeKey, normalized, model);
    if (row) {
      const rates: AiTokenRates = {
        inputPerToken: Number(row.inputCostPerToken),
        outputPerToken: Number(row.outputCostPerToken),
      };
      rateCache.set(cacheKey(normalized, model), rates);
      registerModelRates(normalized, model, rates);
      return inputTokens * rates.inputPerToken + outputTokens * rates.outputPerToken;
    }

    return estimateAiCostUsdLegacy(provider, model, inputTokens, outputTokens);
  }

  invalidateCache(): void {
    rateCache.clear();
    bootstrapped = false;
  }
}

let service: AiCostRateService | null = null;

export function getAiCostRateService(): AiCostRateService {
  if (!service) service = new AiCostRateService();
  return service;
}

export function resetAiCostRateServiceForTests(): void {
  service = null;
}
