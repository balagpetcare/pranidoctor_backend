import type { AiApiKeyTestResult } from './ai-secret.types.js';
import type { AiProviderKey, ProviderRuntimeConfig } from '../providers/core/ai-provider.types.js';
import { getProviderRuntimeConfig, allProviderKeys } from '../providers/provider-config.js';
import {
  appendGoogleApiKey,
  buildAuthHeaders,
  providerFetch,
} from '../providers/core/http.util.js';

function resolveConfig(providerKey: string, baseUrl?: string | null): ProviderRuntimeConfig | null {
  if (!allProviderKeys().includes(providerKey as AiProviderKey)) {
    return null;
  }
  const config = getProviderRuntimeConfig(providerKey as AiProviderKey);
  if (baseUrl?.trim()) {
    return { ...config, baseUrl: baseUrl.replace(/\/$/, '') };
  }
  return config;
}

async function probeOpenAiCompatible(
  config: ProviderRuntimeConfig,
  secret: string,
  start: number,
): Promise<Omit<AiApiKeyTestResult, 'providerKey'>> {
  const response = await providerFetch(`${config.baseUrl}/models`, {
    method: 'GET',
    headers: buildAuthHeaders(config, secret),
    timeoutMs: 15_000,
  });
  if (!response.ok) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      errorCode: `HTTP_${response.status}`,
      message: (await response.text()).slice(0, 200),
    };
  }
  return { ok: true, latencyMs: Date.now() - start };
}

async function probeAnthropic(
  config: ProviderRuntimeConfig,
  secret: string,
  start: number,
): Promise<Omit<AiApiKeyTestResult, 'providerKey'>> {
  const response = await providerFetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: buildAuthHeaders(config, secret),
    body: JSON.stringify({
      model: config.chatModel,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
    timeoutMs: 15_000,
  });
  if (!response.ok) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      errorCode: `HTTP_${response.status}`,
      message: (await response.text()).slice(0, 200),
    };
  }
  return { ok: true, latencyMs: Date.now() - start };
}

async function probeGemini(
  config: ProviderRuntimeConfig,
  secret: string,
  start: number,
): Promise<Omit<AiApiKeyTestResult, 'providerKey'>> {
  const url = appendGoogleApiKey(
    `${config.baseUrl}/models/${config.chatModel}:generateContent`,
    secret,
  );
  const response = await providerFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 1, temperature: 0 },
    }),
    timeoutMs: 15_000,
  });
  if (!response.ok) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      errorCode: `HTTP_${response.status}`,
      message: (await response.text()).slice(0, 200),
    };
  }
  return { ok: true, latencyMs: Date.now() - start };
}

export async function testProviderApiKey(
  providerKey: string,
  secret: string,
  baseUrl?: string | null,
): Promise<Omit<AiApiKeyTestResult, 'providerKey'>> {
  const start = Date.now();

  try {
    const config = resolveConfig(providerKey, baseUrl);
    if (!config) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        errorCode: 'UNSUPPORTED_PROVIDER',
        message: `Live key test not implemented for ${providerKey}`,
      };
    }

    switch (config.adapterType) {
      case 'anthropic_native':
        return probeAnthropic(config, secret, start);
      case 'gemini_native':
        return probeGemini(config, secret, start);
      case 'openai_native':
      case 'openai_compatible':
      case 'openrouter_gateway':
        return probeOpenAiCompatible(config, secret, start);
      default:
        return probeOpenAiCompatible(config, secret, start);
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}
