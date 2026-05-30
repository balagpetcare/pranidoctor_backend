import { getAiSecretService } from '../../vault/ai-secret.service.js';

import { AiProviderError, AiProviderNotConfiguredError } from './ai-provider.errors.js';
import type {
  AiProviderCapability,
  AiProviderKey,
  ProviderRuntimeConfig,
} from './ai-provider.types.js';

export async function providerFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 60_000;
  const { timeoutMs: _drop, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return response;
}

export async function resolveProviderApiKey(key: AiProviderKey): Promise<string> {
  const secret = await getAiSecretService().resolveProviderSecret(key);
  if (!secret) throw new AiProviderNotConfiguredError(key);
  return secret;
}

export function buildAuthHeaders(
  config: ProviderRuntimeConfig,
  apiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.extraHeaders ?? {}),
  };

  switch (config.authHeader) {
    case 'x-api-key':
      headers['x-api-key'] = apiKey;
      break;
    case 'google-api-key':
      break;
    case 'bearer':
    default:
      headers.Authorization = `Bearer ${apiKey}`;
      break;
  }

  return headers;
}

export function appendGoogleApiKey(url: string, apiKey: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('key', apiKey);
  return parsed.toString();
}

export async function parseProviderError(
  provider: AiProviderKey,
  response: Response,
): Promise<never> {
  const body = await response.text();
  throw new AiProviderError(
    `${provider} error ${response.status}: ${body.slice(0, 300)}`,
    `HTTP_${response.status}`,
    provider,
    response.status,
  );
}

export function emptyCapabilities(): Record<AiProviderCapability, boolean> {
  return { chat: false, vision: false, embeddings: false };
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
