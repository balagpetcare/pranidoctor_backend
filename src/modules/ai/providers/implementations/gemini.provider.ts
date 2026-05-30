import { getAiSecretService } from '../../vault/ai-secret.service.js';
import type { IAIProvider } from '../core/ai-provider.interface.js';
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
  appendGoogleApiKey,
  emptyCapabilities,
  estimateTokens,
  parseProviderError,
  providerFetch,
  resolveProviderApiKey,
} from '../core/http.util.js';
import { getProviderRuntimeConfig } from '../provider-config.js';

export class GeminiProvider implements IAIProvider {
  readonly key: AiProviderKey = 'gemini';
  readonly displayName = 'Google Gemini';
  readonly capabilities: readonly AiProviderCapability[] = ['chat', 'vision', 'embeddings'];
  readonly adapterType = 'gemini_native';

  isConfigured(): boolean {
    return getAiSecretService().isProviderConfigured(this.key);
  }

  private config() {
    return getProviderRuntimeConfig(this.key);
  }

  private modelPath(model: string, action: 'generateContent' | 'embedContent'): string {
    const config = this.config();
    return `${config.baseUrl}/models/${model}:${action}`;
  }

  async chat(input: AiChatInput): Promise<AiChatOutput> {
    const config = this.config();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.chatModel;
    const start = Date.now();

    const contents = input.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = input.messages.find((m) => m.role === 'system')?.content;

    const url = appendGoogleApiKey(this.modelPath(model, 'generateContent'), apiKey);
    const response = await providerFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        generationConfig: {
          temperature: input.temperature ?? 0.4,
          maxOutputTokens: input.maxTokens ?? 800,
        },
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return {
      content,
      model,
      provider: this.key,
      inputTokens: json.usageMetadata?.promptTokenCount ?? estimateTokens(JSON.stringify(input.messages)),
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? estimateTokens(content),
      latencyMs: Date.now() - start,
    };
  }

  async vision(input: AiVisionInput): Promise<AiVisionOutput> {
    const config = this.config();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.visionModel;
    const start = Date.now();

    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
    for (const img of input.images) {
      if (img.mediaType === 'base64') {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      } else {
        parts.push({ fileData: { mimeType: img.mimeType, fileUri: img.data } });
      }
    }

    const url = appendGoogleApiKey(this.modelPath(model, 'generateContent'), apiKey);
    const response = await providerFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: input.temperature ?? 0.4,
          maxOutputTokens: input.maxTokens ?? 800,
        },
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return {
      content,
      model,
      provider: this.key,
      inputTokens: json.usageMetadata?.promptTokenCount ?? estimateTokens(input.prompt),
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? estimateTokens(content),
      latencyMs: Date.now() - start,
    };
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedOutput> {
    const config = this.config();
    const apiKey = await resolveProviderApiKey(this.key);
    const model = input.model ?? config.embeddingModel;
    const start = Date.now();

    const url = appendGoogleApiKey(this.modelPath(model, 'embedContent'), apiKey);
    const response = await providerFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: input.texts.map((text) => ({ text })) },
      }),
    });

    if (!response.ok) await parseProviderError(this.key, response);

    const json = (await response.json()) as {
      embedding?: { values?: number[] };
      embeddings?: Array<{ values?: number[] }>;
    };

    const embeddings =
      json.embeddings?.map((e) => e.values ?? []) ??
      (json.embedding?.values ? [json.embedding.values] : []);

    return {
      embeddings,
      model,
      provider: this.key,
      dimensions: embeddings[0]?.length ?? 0,
      totalTokens: input.texts.reduce((sum, t) => sum + estimateTokens(t), 0),
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
