import { getAiSecretService } from '../../vault/ai-secret.service.js';
import type { IAIProvider } from './ai-provider.interface.js';
import { AiProviderNotConfiguredError } from './ai-provider.errors.js';
import type {
  AiChatInput,
  AiChatOutput,
  AiEmbedInput,
  AiEmbedOutput,
  AiProviderCapability,
  AiProviderHealthResult,
  AiProviderKey,
  AiVisionInput,
  AiVisionOutput,
  ProviderRuntimeConfig,
} from './ai-provider.types.js';
import {
  buildAuthHeaders,
  emptyCapabilities,
  estimateTokens,
  parseProviderError,
  providerFetch,
  resolveProviderApiKey,
} from './http.util.js';
import { getProviderRuntimeConfig } from '../provider-config.js';

/** OpenAI-compatible chat / vision / embeddings (OpenAI, Grok, DeepSeek, OpenRouter). */
export abstract class OpenAiCompatibleProvider implements IAIProvider {
  abstract readonly key: AiProviderKey;
  abstract readonly displayName: string;
  readonly capabilities: readonly AiProviderCapability[] = ['chat', 'vision', 'embeddings'];

  get adapterType(): string {
    return this.getConfig().adapterType;
  }

  protected getConfig(): ProviderRuntimeConfig {
    return getProviderRuntimeConfig(this.key);
  }

  isConfigured(): boolean {
    return getAiSecretService().isProviderConfigured(this.key);
  }

  async chat(input: AiChatInput): Promise<AiChatOutput> {
    const config = this.getConfig();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.chatModel;
    const start = Date.now();

    const response = await providerFetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAuthHeaders(config, apiKey),
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 800,
        messages: input.messages,
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = json.choices?.[0]?.message?.content?.trim() ?? '';
    return {
      content,
      model,
      provider: this.key,
      inputTokens: json.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(input.messages)),
      outputTokens: json.usage?.completion_tokens ?? estimateTokens(content),
      latencyMs: Date.now() - start,
    };
  }

  async vision(input: AiVisionInput): Promise<AiVisionOutput> {
    const config = this.getConfig();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.visionModel;
    const start = Date.now();

    const imageParts = input.images.map((img) =>
      img.mediaType === 'url'
        ? { type: 'image_url', image_url: { url: img.data } }
        : {
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          },
    );

    const response = await providerFetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAuthHeaders(config, apiKey),
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 800,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: input.prompt }, ...imageParts],
          },
        ],
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = json.choices?.[0]?.message?.content?.trim() ?? '';
    return {
      content,
      model,
      provider: this.key,
      inputTokens: json.usage?.prompt_tokens ?? estimateTokens(input.prompt),
      outputTokens: json.usage?.completion_tokens ?? estimateTokens(content),
      latencyMs: Date.now() - start,
    };
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedOutput> {
    const config = this.getConfig();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.embeddingModel;
    const start = Date.now();

    const response = await providerFetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: buildAuthHeaders(config, apiKey),
      body: JSON.stringify({ model, input: input.texts }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      usage?: { total_tokens?: number; prompt_tokens?: number };
      model?: string;
    };

    const embeddings = (json.data ?? []).map((row) => row.embedding ?? []);
    const dimensions = embeddings[0]?.length ?? 0;

    return {
      embeddings,
      model: json.model ?? model,
      provider: this.key,
      dimensions,
      totalTokens: json.usage?.total_tokens ?? json.usage?.prompt_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  }

  async healthCheck(): Promise<AiProviderHealthResult> {
    const capabilities = emptyCapabilities();
    if (!this.isConfigured()) {
      return {
        provider: this.key,
        configured: false,
        reachable: false,
        latencyMs: 0,
        capabilities,
        errorCode: 'not_configured',
        message: 'Vault key not configured',
      };
    }

    const start = Date.now();
    try {
      const config = this.getConfig();
      const apiKey = await resolveProviderApiKey(this.key);

      const modelsRes = await providerFetch(`${config.baseUrl}/models`, {
        method: 'GET',
        headers: buildAuthHeaders(config, apiKey),
        timeoutMs: 15_000,
      });

      if (modelsRes.ok) {
        capabilities.chat = true;
        capabilities.vision = true;
        capabilities.embeddings = true;
        return {
          provider: this.key,
          configured: true,
          reachable: true,
          latencyMs: Date.now() - start,
          capabilities,
        };
      }

      await this.chat({
        feature: 'HEALTH_PROBE',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 5,
        temperature: 0,
      });
      capabilities.chat = true;
      capabilities.vision = true;
      capabilities.embeddings = true;

      return {
        provider: this.key,
        configured: true,
        reachable: true,
        latencyMs: Date.now() - start,
        capabilities,
      };
    } catch (error) {
      return {
        provider: this.key,
        configured: true,
        reachable: false,
        latencyMs: Date.now() - start,
        capabilities,
        errorCode: error instanceof AiProviderNotConfiguredError ? 'not_configured' : 'probe_failed',
        message: error instanceof Error ? error.message : 'Health probe failed',
      };
    }
  }
}
