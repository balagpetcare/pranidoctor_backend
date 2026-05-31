import type { AiProviderAdapter } from '../../orchestrator/provider.interface.js';
import { RulesBasedProvider } from '../../orchestrator/providers/rules.provider.js';
import { createOrchestratorAdapterFromKey } from '../../providers/orchestrator-bridge.js';

/** Creates provider adapters by registry key — extensible for future providers. */
export interface IProviderAdapterFactory {
  create(providerKey: string): AiProviderAdapter;
  supports(providerKey: string): boolean;
}

export class ProviderAdapterFactory implements IProviderAdapterFactory {
  readonly name = 'ProviderAdapterFactory';

  private readonly customFactories = new Map<string, () => AiProviderAdapter>();

  register(providerKey: string, factory: () => AiProviderAdapter): void {
    this.customFactories.set(providerKey, factory);
  }

  supports(providerKey: string): boolean {
    if (providerKey === 'rules-based') return true;
    if (this.customFactories.has(providerKey)) return true;
    try {
      createOrchestratorAdapterFromKey(providerKey);
      return true;
    } catch {
      return false;
    }
  }

  create(providerKey: string): AiProviderAdapter {
    const custom = this.customFactories.get(providerKey);
    if (custom) return custom();

    if (providerKey === 'rules-based') {
      return new RulesBasedProvider();
    }

    return createOrchestratorAdapterFromKey(providerKey);
  }
}

let providerAdapterFactory: ProviderAdapterFactory | null = null;

export function getProviderAdapterFactory(): ProviderAdapterFactory {
  if (!providerAdapterFactory) providerAdapterFactory = new ProviderAdapterFactory();
  return providerAdapterFactory;
}

export function resetProviderAdapterFactoryForTests(): void {
  providerAdapterFactory = null;
}
