import { getAiSecretService } from '../../vault/ai-secret.service.js';
import type { IAIProvider } from '../core/ai-provider.interface.js';
import { AiProviderNotConfiguredError } from '../core/ai-provider.errors.js';
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
} from '../core/ai-provider.types.js';
import {
  buildAuthHeaders,
  emptyCapabilities,
  estimateTokens,
  parseProviderError,
  providerFetch,
  resolveProviderApiKey,
} from '../core/http.util.js';
import { getProviderRuntimeConfig } from '../provider-config.js';

export class AnthropicProvider implements IAIProvider {
  readonly key: AiProviderKey = 'anthropic';
  readonly displayName = 'Anthropic';
  readonly capabilities: readonly AiProviderCapability[] = ['chat', 'vision', 'embeddings'];
  readonly adapterType = 'anthropic_native';

  isConfigured(): boolean {
    return getAiSecretService().isProviderConfigured(this.key);
  }

  private config() {
    return getProviderRuntimeConfig(this.key);
  }

  async chat(input: AiChatInput): Promise<AiChatOutput> {
    const config = this.config();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.chatModel;
    const start = Date.now();

    const system = input.messages.find((m) => m.role === 'system')?.content;
    const userMessages = input.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const response = await providerFetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: buildAuthHeaders(config, apiKey),
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 800,
        temperature: input.temperature ?? 0.4,
        ...(system ? { system } : {}),
        messages: userMessages.length > 0 ? userMessages : [{ role: 'user', content: 'hello' }],
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const content = json.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
    return {
      content,
      model,
      provider: this.key,
      inputTokens: json.usage?.input_tokens ?? estimateTokens(JSON.stringify(input.messages)),
      outputTokens: json.usage?.output_tokens ?? estimateTokens(content),
      latencyMs: Date.now() - start,
    };
  }

  async vision(input: AiVisionInput): Promise<AiVisionOutput> {
    const config = this.config();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.visionModel;
    const start = Date.now();

    const contentBlocks: Array<Record<string, unknown>> = [{ type: 'text', text: input.prompt }];
    for (const img of input.images) {
      if (img.mediaType === 'url') {
        contentBlocks.push({
          type: 'image',
          source: { type: 'url', url: img.data },
        });
      } else {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mimeType, data: img.data },
        });
      }
    }

    const response = await providerFetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: buildAuthHeaders(config, apiKey),
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 800,
        temperature: input.temperature ?? 0.4,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const content = json.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
    return {
      content,
      model,
      provider: this.key,
      inputTokens: json.usage?.input_tokens ?? estimateTokens(input.prompt),
      outputTokens: json.usage?.output_tokens ?? estimateTokens(content),
      latencyMs: Date.now() - start,
    };
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedOutput> {
    const config = this.config();
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
      usage?: { input_tokens?: number };
      model?: string;
    };

    const embeddings = (json.data ?? []).map((row) => row.embedding ?? []);
    return {
      embeddings,
      model: json.model ?? model,
      provider: this.key,
      dimensions: embeddings[0]?.length ?? 0,
      totalTokens: json.usage?.input_tokens ?? 0,
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
      };
    }

    const start = Date.now();
    try {
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
        errorCode: 'probe_failed',
        message: error instanceof Error ? error.message : 'Health probe failed',
      };
    }
  }
}
