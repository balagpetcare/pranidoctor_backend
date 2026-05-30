import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiProviderNotConfiguredError } from './core/ai-provider.errors.js';
import { OpenAIProvider } from './implementations/openai-compatible.providers.js';
import { AnthropicProvider } from './implementations/anthropic.provider.js';
import { GeminiProvider } from './implementations/gemini.provider.js';
import {
  AiProviderDiscovery,
  resetAiProviderDiscoveryForTests,
} from './provider-discovery.js';
import {
  AiProviderFactory,
  ensureAiProvidersBootstrapped,
  resetAiProviderBootstrapForTests,
  resetAiProviderFactoryForTests,
} from './provider-factory.js';
import { allProviderKeys } from './provider-config.js';
import {
  AiProviderRegistry,
  getAiProviderRegistry,
  resetAiProviderRegistryForTests,
} from './provider-registry.js';
import { createOrchestratorAdapter } from './orchestrator-bridge.js';

const isConfiguredMock = vi.fn();
const resolveSecretMock = vi.fn();

vi.mock('../vault/ai-secret.service.js', () => ({
  getAiSecretService: () => ({
    isProviderConfigured: isConfiguredMock,
    resolveProviderSecret: resolveSecretMock,
  }),
}));

function resetProviderLayerForTests(): void {
  resetAiProviderRegistryForTests();
  resetAiProviderFactoryForTests();
  resetAiProviderBootstrapForTests();
  resetAiProviderDiscoveryForTests();
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('AiProviderRegistry', () => {
  afterEach(() => resetProviderLayerForTests());

  it('registers and retrieves providers', () => {
    const registry = new AiProviderRegistry();
    const provider = new OpenAIProvider();
    registry.register(provider);

    expect(registry.has('openai')).toBe(true);
    expect(registry.get('openai')).toBe(provider);
    expect(registry.keys()).toEqual(['openai']);
  });

  it('throws when provider is missing', () => {
    const registry = new AiProviderRegistry();
    expect(() => registry.getOrThrow('openai')).toThrow('AI provider not registered: openai');
  });

  it('lists configured providers only', () => {
    isConfiguredMock.mockImplementation((key: string) => key === 'openai');
    const factory = new AiProviderFactory();
    const registry = new AiProviderRegistry();
    registry.registerMany(factory.createAll());

    expect(registry.listConfigured().map((p) => p.key)).toEqual(['openai']);
  });
});

describe('AiProviderFactory', () => {
  afterEach(() => resetProviderLayerForTests());

  it('creates all built-in providers including self-hosted', () => {
    const factory = new AiProviderFactory();
    const providers = factory.createAll();
    expect(providers.map((p) => p.key)).toEqual(allProviderKeys());
    for (const provider of providers) {
      if (provider.key === 'self_hosted') {
        expect(provider.capabilities).toEqual(['chat', 'embeddings']);
      } else {
        expect(provider.capabilities).toEqual(['chat', 'vision', 'embeddings']);
      }
    }
  });

  it('bootstraps the global registry once', () => {
    ensureAiProvidersBootstrapped();
    const registry = getAiProviderRegistry();
    expect(registry.keys()).toEqual(allProviderKeys());
    ensureAiProvidersBootstrapped();
    expect(registry.keys()).toEqual(allProviderKeys());
  });
});

describe('AiProviderDiscovery', () => {
  afterEach(() => resetProviderLayerForTests());

  beforeEach(() => {
    isConfiguredMock.mockReturnValue(false);
  });

  it('returns static catalog without network', () => {
    ensureAiProvidersBootstrapped();
    const discovery = new AiProviderDiscovery();
    const items = discovery.discover();

    expect(items).toHaveLength(allProviderKeys().length);
    expect(items.every((item) => item.capabilities.length >= 2)).toBe(true);
    expect(items.every((item) => item.configured === false)).toBe(true);
  });

  it('runs health checks for configured providers', async () => {
    isConfiguredMock.mockImplementation((key: string) => key === 'openai');
    resolveSecretMock.mockResolvedValue('sk-test');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockFetchResponse({ data: [{ id: 'gpt-4o-mini' }] })),
    );

    ensureAiProvidersBootstrapped();
    const discovery = new AiProviderDiscovery();
    const items = await discovery.discoverWithHealth({ includeUnconfigured: false });

    expect(items).toHaveLength(1);
    expect(items[0]?.key).toBe('openai');
    expect(items[0]?.health?.reachable).toBe(true);
    expect(items[0]?.liveCapabilities.chat).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('OpenAIProvider', () => {
  afterEach(() => {
    resetProviderLayerForTests();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true);
    resolveSecretMock.mockResolvedValue('sk-test');
  });

  it('chat returns model output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: 'Hello farmer' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      ),
    );

    const provider = new OpenAIProvider();
    const result = await provider.chat({
      feature: 'TEST',
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ],
    });

    expect(result.content).toBe('Hello farmer');
    expect(result.provider).toBe('openai');
    expect(result.inputTokens).toBe(10);
  });

  it('vision sends multimodal payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: 'Healthy cow' } }],
        usage: { prompt_tokens: 20, completion_tokens: 3 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIProvider();
    await provider.vision({
      feature: 'VISION',
      prompt: 'Describe animal',
      images: [{ data: 'abc123', mimeType: 'image/jpeg', mediaType: 'base64' }],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toEqual(
      expect.arrayContaining([
        { type: 'text', text: 'Describe animal' },
        expect.objectContaining({ type: 'image_url' }),
      ]),
    );
  });

  it('embed returns vectors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { total_tokens: 4 },
          model: 'text-embedding-3-small',
        }),
      ),
    );

    const provider = new OpenAIProvider();
    const result = await provider.embed({ feature: 'EMBED', texts: ['hello'] });

    expect(result.embeddings).toEqual([[0.1, 0.2]]);
    expect(result.dimensions).toBe(2);
  });

  it('healthCheck reports not configured', async () => {
    isConfiguredMock.mockReturnValue(false);
    const provider = new OpenAIProvider();
    const health = await provider.healthCheck();
    expect(health.configured).toBe(false);
    expect(health.errorCode).toBe('not_configured');
  });

  it('throws when secret is missing during chat', async () => {
    resolveSecretMock.mockResolvedValue(null);
    const provider = new OpenAIProvider();
    await expect(
      provider.chat({ feature: 'TEST', messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
  });
});

describe('AnthropicProvider', () => {
  afterEach(() => {
    resetProviderLayerForTests();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true);
    resolveSecretMock.mockResolvedValue('anthropic-key');
  });

  it('chat parses anthropic message payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          content: [{ type: 'text', text: 'Claude reply' }],
          usage: { input_tokens: 8, output_tokens: 4 },
        }),
      ),
    );

    const provider = new AnthropicProvider();
    const result = await provider.chat({
      feature: 'TEST',
      messages: [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Question' },
      ],
    });

    expect(result.content).toBe('Claude reply');
    expect(result.provider).toBe('anthropic');
  });
});

describe('GeminiProvider', () => {
  afterEach(() => {
    resetProviderLayerForTests();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true);
    resolveSecretMock.mockResolvedValue('gemini-key');
  });

  it('chat parses gemini candidates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{ content: { parts: [{ text: 'Gemini reply' }] } }],
          usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 2 },
        }),
      ),
    );

    const provider = new GeminiProvider();
    const result = await provider.chat({
      feature: 'TEST',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.content).toBe('Gemini reply');
    expect(result.provider).toBe('gemini');
  });
});

describe('createOrchestratorAdapter', () => {
  afterEach(() => {
    resetProviderLayerForTests();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true);
    resolveSecretMock.mockResolvedValue('sk-test');
  });

  it('maps chat output to legacy completion contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: 'Orchestrated' } }],
          usage: { prompt_tokens: 12, completion_tokens: 6 },
        }),
      ),
    );

    const adapter = createOrchestratorAdapter('openai');
    const result = await adapter.complete({
      feature: 'ASSISTANT',
      systemPrompt: 'System',
      userMessage: 'User',
      locale: 'en',
    });

    expect(result.provider).toBe('openai');
    expect(result.content).toBe('Orchestrated');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('uses locale fallback when model returns empty content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: '   ' } }],
          usage: { prompt_tokens: 1, completion_tokens: 0 },
        }),
      ),
    );

    const adapter = createOrchestratorAdapter('openai');
    const result = await adapter.complete({
      feature: 'ASSISTANT',
      systemPrompt: 'System',
      userMessage: 'User',
      locale: 'bn',
    });

    expect(result.content).toContain('দুঃখিত');
  });
});
