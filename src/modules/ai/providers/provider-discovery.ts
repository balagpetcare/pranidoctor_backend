import type { DiscoveredProvider } from './core/ai-provider.types.js';
import { ensureAiProvidersBootstrapped } from './provider-factory.js';
import { getProviderRuntimeConfig } from './provider-config.js';
import { getAiProviderRegistry } from './provider-registry.js';

export class AiProviderDiscovery {
  readonly name = 'AiProviderDiscovery';

  /** Static catalog — configured status from vault cache, no network. */
  discover(): DiscoveredProvider[] {
    ensureAiProvidersBootstrapped();
    const registry = getAiProviderRegistry();

    return registry.list().map((provider) => {
      const config = getProviderRuntimeConfig(provider.key);
      return {
        key: provider.key,
        displayName: provider.displayName,
        configured: provider.isConfigured(),
        capabilities: [...provider.capabilities],
        liveCapabilities: {
          chat: provider.capabilities.includes('chat'),
          vision: provider.capabilities.includes('vision'),
          embeddings: provider.capabilities.includes('embeddings'),
        },
        adapterType: provider.adapterType,
        baseUrl: config.baseUrl,
        models: {
          chat: config.chatModel,
          vision: config.visionModel,
          embedding: config.embeddingModel,
        },
      };
    });
  }

  /** Runs healthCheck on each configured provider (network). */
  async discoverWithHealth(options?: { includeUnconfigured?: boolean }): Promise<DiscoveredProvider[]> {
    ensureAiProvidersBootstrapped();
    const registry = getAiProviderRegistry();
    const includeUnconfigured = options?.includeUnconfigured ?? true;

    const providers = registry.list().filter(
      (p) => includeUnconfigured || p.isConfigured(),
    );

    const results: DiscoveredProvider[] = [];

    for (const provider of providers) {
      const config = getProviderRuntimeConfig(provider.key);
      const base: DiscoveredProvider = {
        key: provider.key,
        displayName: provider.displayName,
        configured: provider.isConfigured(),
        capabilities: [...provider.capabilities],
        liveCapabilities: {
          chat: false,
          vision: false,
          embeddings: false,
        },
        adapterType: provider.adapterType,
        baseUrl: config.baseUrl,
        models: {
          chat: config.chatModel,
          vision: config.visionModel,
          embedding: config.embeddingModel,
        },
      };

      if (provider.isConfigured()) {
        const health = await provider.healthCheck();
        base.health = health;
        base.liveCapabilities = health.capabilities;
      }

      results.push(base);
    }

    return results;
  }
}

let discovery: AiProviderDiscovery | null = null;

export function getAiProviderDiscovery(): AiProviderDiscovery {
  if (!discovery) discovery = new AiProviderDiscovery();
  return discovery;
}

export function resetAiProviderDiscoveryForTests(): void {
  discovery = null;
}
