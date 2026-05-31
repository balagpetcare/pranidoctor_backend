import { ensureAiProvidersBootstrapped } from '../../providers/provider-factory.js';
import { getAiProviderRegistry } from '../../providers/provider-registry.js';
import type { AiProviderKey } from '../../providers/core/ai-provider.types.js';
import { getAiRouterEngine } from '../../router/ai-router-engine.service.js';
import type { AiEmbedOutput } from '../../providers/core/ai-provider.types.js';
import { deterministicEmbedVector } from './vector-math.util.js';
import { resolveVreConfig } from '../config/vre-config.js';

const EMBEDDING_PROVIDER_FALLBACK: AiProviderKey[] = ['openai', 'gemini', 'openrouter', 'anthropic'];

export type EmbeddingRouterResult = AiEmbedOutput;

export class EmbeddingRouterAdapter {
  readonly name = 'EmbeddingRouterAdapter';

  async embedTexts(texts: string[], feature: string): Promise<EmbeddingRouterResult | null> {
    if (texts.length === 0) return null;

    try {
      const routed = await getAiRouterEngine().executeEmbedding({
        feature,
        texts,
        taskType: 'DOCUMENT_ANALYSIS',
      });
      if (routed.embeddings.length > 0) return routed;
    } catch {
      // fall through to direct provider chain
    }

    ensureAiProvidersBootstrapped();
    const registry = getAiProviderRegistry();

    for (const key of EMBEDDING_PROVIDER_FALLBACK) {
      try {
        const provider = registry.get(key);
        if (!provider?.isConfigured()) continue;
        if (!provider.capabilities.includes('embeddings')) continue;
        const result = await provider.embed({ feature, texts });
        if (result.embeddings.length > 0) return result;
      } catch {
        continue;
      }
    }

    if (resolveVreConfig().deterministicEmbedFallback) {
      const dimensions = 1536;
      return {
        embeddings: texts.map((text) => deterministicEmbedVector(text, dimensions)),
        model: 'local-deterministic-v1',
        provider: 'openai',
        dimensions,
        totalTokens: 0,
        latencyMs: 0,
      };
    }

    return null;
  }
}

let adapter: EmbeddingRouterAdapter | null = null;

export function getEmbeddingRouterAdapter(): EmbeddingRouterAdapter {
  if (!adapter) adapter = new EmbeddingRouterAdapter();
  return adapter;
}

export function resetEmbeddingRouterAdapterForTests(): void {
  adapter = null;
}
