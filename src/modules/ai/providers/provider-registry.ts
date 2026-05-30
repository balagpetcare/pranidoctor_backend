import type { IAIProvider } from './core/ai-provider.interface.js';
import type { AiProviderKey } from './core/ai-provider.types.js';

export class AiProviderRegistry {
  readonly name = 'AiProviderRegistry';

  private readonly providers = new Map<string, IAIProvider>();

  register(provider: IAIProvider): void {
    this.providers.set(provider.key, provider);
  }

  registerMany(providers: IAIProvider[]): void {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  get(key: string): IAIProvider | undefined {
    return this.providers.get(key);
  }

  getOrThrow(key: string): IAIProvider {
    const provider = this.get(key);
    if (!provider) {
      throw new Error(`AI provider not registered: ${key}`);
    }
    return provider;
  }

  has(key: string): boolean {
    return this.providers.has(key);
  }

  list(): IAIProvider[] {
    return [...this.providers.values()];
  }

  listConfigured(): IAIProvider[] {
    return this.list().filter((p) => p.isConfigured());
  }

  keys(): string[] {
    return [...this.providers.keys()];
  }

  clear(): void {
    this.providers.clear();
  }
}

let registry: AiProviderRegistry | null = null;

export function getAiProviderRegistry(): AiProviderRegistry {
  if (!registry) {
    registry = new AiProviderRegistry();
  }
  return registry;
}

export function resetAiProviderRegistryForTests(): void {
  registry?.clear();
  registry = null;
}
