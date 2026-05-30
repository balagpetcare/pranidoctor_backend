import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { ensureAiProvidersBootstrapped } from '../providers/provider-factory.js';
import { getAiProviderRegistry } from '../providers/provider-registry.js';
import { getAiAdapterRegistry } from './adapter-registry.js';
import { getExtensionLoaderService } from './extension-loader.service.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';

export class MarketplaceBootstrapService {
  readonly name = 'MarketplaceBootstrapService';

  async bootstrap(scopeKey = PLATFORM_SCOPE_KEY): Promise<{
    builtinProviders: number;
    extensionsLoaded: number;
    adapterTypes: string[];
    registryKeys: string[];
  }> {
    ensureAiProvidersBootstrapped();
    getAiAdapterRegistry();

    const extensionsLoaded = await getExtensionLoaderService().loadActiveExtensions(scopeKey);
    const registry = getAiProviderRegistry();

    logAiExecution('ai_marketplace_bootstrapped', {
      scopeKey,
      builtinProviders: registry.keys().length,
      extensionsLoaded,
    });

    return {
      builtinProviders: registry.keys().length,
      extensionsLoaded,
      adapterTypes: getAiAdapterRegistry().listAdapterTypes(),
      registryKeys: registry.keys(),
    };
  }
}

let service: MarketplaceBootstrapService | null = null;

export function getMarketplaceBootstrapService(): MarketplaceBootstrapService {
  if (!service) service = new MarketplaceBootstrapService();
  return service;
}

export function resetMarketplaceBootstrapServiceForTests(): void {
  service = null;
}
