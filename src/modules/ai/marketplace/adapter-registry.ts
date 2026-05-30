import type { IAIProvider } from '../providers/core/ai-provider.interface.js';
import type { ProviderRuntimeConfig } from '../providers/core/ai-provider.types.js';
import type { ExtensionManifest } from './marketplace.types.js';
import { DynamicOpenAiCompatibleProvider } from './adapters/dynamic-openai.provider.js';
import { SelfHostedLlmProvider } from './adapters/self-hosted.provider.js';
import { AI_ADAPTER_TYPES } from './marketplace.types.js';

export type AdapterBuildInput = {
  providerKey: string;
  displayName: string;
  manifest: ExtensionManifest;
  dbConfig?: {
    baseUrl?: string | null;
    configJson?: unknown;
  };
};

export type AdapterFactory = (input: AdapterBuildInput) => IAIProvider;

export class AiAdapterRegistry {
  readonly name = 'AiAdapterRegistry';

  private readonly factories = new Map<string, AdapterFactory>();

  register(adapterType: string, factory: AdapterFactory): void {
    this.factories.set(adapterType, factory);
  }

  has(adapterType: string): boolean {
    return this.factories.has(adapterType);
  }

  listAdapterTypes(): string[] {
    return [...this.factories.keys()];
  }

  build(adapterType: string, input: AdapterBuildInput): IAIProvider {
    const factory = this.factories.get(adapterType);
    if (!factory) {
      throw new Error(`No adapter registered for type: ${adapterType}`);
    }
    return factory(input);
  }

  tryBuild(adapterType: string, input: AdapterBuildInput): IAIProvider | null {
    if (!this.has(adapterType)) return null;
    return this.build(adapterType, input);
  }
}

function mergeRuntimeConfig(input: AdapterBuildInput): ProviderRuntimeConfig {
  const cfg = input.manifest.config ?? {};
  const dbJson =
    input.dbConfig?.configJson && typeof input.dbConfig.configJson === 'object'
      ? (input.dbConfig.configJson as Record<string, unknown>)
      : {};

  return {
    baseUrl:
      (cfg.baseUrl ?? input.dbConfig?.baseUrl ?? dbJson.baseUrl ?? 'http://localhost:11434/v1') as string,
    chatModel: (cfg.chatModel ?? dbJson.chatModel ?? 'default') as string,
    visionModel: (cfg.visionModel ?? dbJson.visionModel ?? cfg.chatModel ?? 'default') as string,
    embeddingModel: (cfg.embeddingModel ?? dbJson.embeddingModel ?? 'default') as string,
    adapterType: input.manifest.adapterType,
    authHeader: cfg.authHeader ?? 'bearer',
    extraHeaders: cfg.extraHeaders,
  };
}

function openAiCompatibleFactory(input: AdapterBuildInput): IAIProvider {
  const secretKey = input.manifest.config?.secretProviderKey ?? input.providerKey;
  return new DynamicOpenAiCompatibleProvider({
    key: input.providerKey,
    displayName: input.displayName,
    runtimeConfig: mergeRuntimeConfig(input),
    secretProviderKey: secretKey,
  });
}

function openRouterFactory(input: AdapterBuildInput): IAIProvider {
  const config = mergeRuntimeConfig(input);
  return new DynamicOpenAiCompatibleProvider({
    key: input.providerKey,
    displayName: input.displayName,
    runtimeConfig: {
      ...config,
      adapterType: AI_ADAPTER_TYPES.OPENROUTER_GATEWAY,
      extraHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'https://pranidoctor.com',
        'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'Prani Doctor',
        ...config.extraHeaders,
      },
    },
    secretProviderKey: input.manifest.config?.secretProviderKey ?? 'openrouter',
  });
}

function selfHostedFactory(input: AdapterBuildInput): IAIProvider {
  return new SelfHostedLlmProvider({
    key: input.providerKey,
    displayName: input.displayName,
    runtimeConfig: mergeRuntimeConfig(input),
    secretProviderKey: input.manifest.config?.secretProviderKey ?? input.providerKey,
  });
}

function veterinaryCustomFactory(input: AdapterBuildInput): IAIProvider {
  const provider = openAiCompatibleFactory(input);
  return provider;
}

let adapterRegistry: AiAdapterRegistry | null = null;

export function getAiAdapterRegistry(): AiAdapterRegistry {
  if (!adapterRegistry) {
    adapterRegistry = new AiAdapterRegistry();
    registerBuiltinAdapters(adapterRegistry);
  }
  return adapterRegistry;
}

export function registerBuiltinAdapters(registry: AiAdapterRegistry): void {
  registry.register(AI_ADAPTER_TYPES.OPENAI_COMPATIBLE, openAiCompatibleFactory);
  registry.register(AI_ADAPTER_TYPES.OPENAI_NATIVE, openAiCompatibleFactory);
  registry.register(AI_ADAPTER_TYPES.OPENROUTER_GATEWAY, openRouterFactory);
  registry.register(AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI, selfHostedFactory);
  registry.register(AI_ADAPTER_TYPES.VETERINARY_CUSTOM, veterinaryCustomFactory);
}

export function resetAiAdapterRegistryForTests(): void {
  adapterRegistry = null;
}
