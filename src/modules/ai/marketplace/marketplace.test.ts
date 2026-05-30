import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAiAdapterRegistry,
  registerBuiltinAdapters,
  resetAiAdapterRegistryForTests,
} from './adapter-registry.js';
import { AI_ADAPTER_TYPES, extensionManifestSchema } from './marketplace.types.js';
import { createSelfHostedProvider } from './adapters/self-hosted.provider.js';
import { resetExtensionLoaderServiceForTests } from './extension-loader.service.js';
import { resetExternalModelRegistrationServiceForTests } from './external-model.service.js';
import { resetMarketplaceBootstrapServiceForTests } from './marketplace-bootstrap.service.js';
import { DynamicOpenAiCompatibleProvider } from './adapters/dynamic-openai.provider.js';
import {
  resetAiProviderBootstrapForTests,
  resetAiProviderFactoryForTests,
} from '../providers/provider-factory.js';
import {
  getAiProviderRegistry,
  resetAiProviderRegistryForTests,
} from '../providers/provider-registry.js';

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: vi.fn(),
}));

vi.mock('../vault/ai-secret.service.js', () => ({
  getAiSecretService: () => ({
    isProviderConfigured: vi.fn().mockReturnValue(false),
    resolveProviderSecret: vi.fn(),
  }),
}));

function resetMarketplaceForTests(): void {
  resetAiAdapterRegistryForTests();
  resetAiProviderRegistryForTests();
  resetAiProviderFactoryForTests();
  resetAiProviderBootstrapForTests();
  resetExtensionLoaderServiceForTests();
  resetExternalModelRegistrationServiceForTests();
  resetMarketplaceBootstrapServiceForTests();
}

describe('marketplace extension framework', () => {
  afterEach(resetMarketplaceForTests);

  it('registers built-in adapter types', () => {
    const registry = getAiAdapterRegistry();
    expect(registry.listAdapterTypes()).toContain(AI_ADAPTER_TYPES.OPENROUTER_GATEWAY);
    expect(registry.listAdapterTypes()).toContain(AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI);
    expect(registry.listAdapterTypes()).toContain(AI_ADAPTER_TYPES.VETERINARY_CUSTOM);
  });

  it('builds dynamic OpenAI-compatible provider from manifest', () => {
    const registry = getAiAdapterRegistry();
    const provider = registry.build(AI_ADAPTER_TYPES.OPENROUTER_GATEWAY, {
      providerKey: 'openrouter',
      displayName: 'OpenRouter',
      manifest: {
        extensionKey: 'openrouter_gateway',
        name: 'OpenRouter',
        version: '1.0.0',
        adapterType: AI_ADAPTER_TYPES.OPENROUTER_GATEWAY,
        providerKey: 'openrouter',
        config: { baseUrl: 'https://openrouter.ai/api/v1' },
      },
    });
    expect(provider.key).toBe('openrouter');
    expect(provider.adapterType).toBe(AI_ADAPTER_TYPES.OPENROUTER_GATEWAY);
  });

  it('creates self-hosted provider with configurable base URL', () => {
    const provider = createSelfHostedProvider({
      baseUrl: 'http://localhost:11434/v1',
      chatModel: 'llama3.2',
    });
    expect(provider.key).toBe('self_hosted');
    expect(provider.displayName).toBe('Self-hosted LLM');
  });

  it('validates extension manifest schema', () => {
    const manifest = extensionManifestSchema.parse({
      extensionKey: 'custom_plugin',
      name: 'Custom Plugin',
      version: '1.0.0',
      adapterType: AI_ADAPTER_TYPES.OPENAI_COMPATIBLE,
      providerKey: 'custom_vendor',
    });
    expect(manifest.extensionKey).toBe('custom_plugin');
  });

  it('registers dynamic providers in global registry', () => {
    const adapterRegistry = getAiAdapterRegistry();
    registerBuiltinAdapters(adapterRegistry);
    const provider = new DynamicOpenAiCompatibleProvider({
      key: 'custom_vendor',
      displayName: 'Custom Vendor',
      secretProviderKey: 'custom_vendor',
      runtimeConfig: {
        adapterType: AI_ADAPTER_TYPES.OPENAI_COMPATIBLE,
        authHeader: 'bearer',
        baseUrl: 'https://api.example.com/v1',
        chatModel: 'model-a',
        visionModel: 'model-a',
        embeddingModel: 'embed-a',
      },
    });
    getAiProviderRegistry().register(provider);
    expect(getAiProviderRegistry().has('custom_vendor')).toBe(true);
  });
});
