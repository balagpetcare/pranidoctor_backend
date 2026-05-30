import type { ProviderChainEntry } from './ai-router.types.js';

export function parseProviderChainJson(raw: unknown): ProviderChainEntry[] {
  if (!Array.isArray(raw)) return [];

  const entries: ProviderChainEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const providerKey = typeof row.providerKey === 'string' ? row.providerKey : null;
    const providerId = typeof row.providerId === 'string' ? row.providerId : null;
    const order = typeof row.order === 'number' ? row.order : entries.length;
    if (!providerKey || !providerId) continue;

    entries.push({
      order,
      providerKey,
      providerId,
      modelId: typeof row.modelId === 'string' ? row.modelId : null,
    });
  }

  return entries.sort((a, b) => a.order - b.order);
}
