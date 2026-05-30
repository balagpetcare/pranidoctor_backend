import { getAiSecretService } from '../vault/ai-secret.service.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import type { OpenRouterModelCatalogEntry } from './marketplace.types.js';
import { getExternalModelRegistrationService } from './external-model.service.js';

export class OpenRouterCatalogService {
  readonly name = 'OpenRouterCatalogService';

  private readonly externalModels = getExternalModelRegistrationService();

  async fetchCatalog(): Promise<OpenRouterModelCatalogEntry[]> {
    const apiKey = await this.resolveOpenRouterKey();
    const baseUrl = process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1';

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'https://pranidoctor.com',
        'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'Prani Doctor',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter catalog fetch failed: HTTP ${response.status}`);
    }

    const json = (await response.json()) as { data?: OpenRouterModelCatalogEntry[] };
    return json.data ?? [];
  }

  async syncSelectedModels(options: {
    modelIds: string[];
    scopeKey?: string;
    defaultCategory?: string;
  }): Promise<{ registered: number; skipped: number }> {
    const scopeKey = options.scopeKey ?? PLATFORM_SCOPE_KEY;
    const prisma = getPrisma();

    const provider = await prisma.aiProvider.findFirst({
      where: { scopeKey, providerKey: 'openrouter', deletedAt: null },
    });
    if (!provider) throw new Error('OpenRouter provider not found in registry — seed or create first');

    const catalog = await this.fetchCatalog();
    const selected = catalog.filter((entry) => options.modelIds.includes(entry.id));

    let registered = 0;
    let skipped = 0;

    for (const entry of selected) {
      const modelKey = entry.id.replace(/\//g, '_').slice(0, 128);
      const promptCost = entry.pricing?.prompt ? Number.parseFloat(entry.pricing.prompt) : 0;
      const completionCost = entry.pricing?.completion ? Number.parseFloat(entry.pricing.completion) : 0;

      await this.externalModels.register({
        providerId: provider.id,
        modelKey,
        displayName: entry.name,
        externalModelId: entry.id,
        source: 'EXTERNAL',
        modelCategory: options.defaultCategory ?? 'general_chat',
        contextWindow: entry.context_length,
        inputCostPerToken: promptCost,
        outputCostPerToken: completionCost,
        metadataJson: {
          openRouterId: entry.id,
          description: entry.description,
          syncedAt: new Date().toISOString(),
        },
      });
      registered += 1;
    }

    skipped = options.modelIds.length - selected.length;
    return { registered, skipped };
  }

  private async resolveOpenRouterKey(): Promise<string> {
    if (getAiSecretService().isProviderConfigured('openrouter')) {
      return getAiSecretService().resolveProviderSecret('openrouter');
    }
    const envKey = process.env.OPENROUTER_API_KEY?.trim();
    if (envKey) return envKey;
    throw new Error('OpenRouter API key not configured');
  }
}

let service: OpenRouterCatalogService | null = null;

export function getOpenRouterCatalogService(): OpenRouterCatalogService {
  if (!service) service = new OpenRouterCatalogService();
  return service;
}

export function resetOpenRouterCatalogServiceForTests(): void {
  service = null;
}
