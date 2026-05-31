import { AiSettingsCategory } from '../../../generated/prisma/index.js';
import { toInputJson } from '../../../shared/database/prisma-json.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getLogger } from '../../../shared/logger/logger.js';
import { getAiPlatformConfig } from '../config/ai.config.js';
import { resolveFoundationScope, scopeKeysForHierarchy } from '../foundation/ai-scope.util.js';
import type { AiFoundationScope } from '../foundation/ai-foundation.types.js';

import { getCached, invalidateSettingsCache, setCached } from './ai-settings.cache.js';
import { getAiSettingsRepository } from './ai-settings.repository.js';
import type {
  AiBudgetSettings,
  AiEncryptionSettings,
  AiGovernanceSettings,
  AiRoutingSettings,
  AiSettingsSnapshot,
  AiSettingsView,
} from './ai-settings.types.js';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mergeJson<T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown>): T {
  return { ...base, ...overlay } as T;
}

function defaultRouting(): AiRoutingSettings {
  const config = getAiPlatformConfig();
  return {
    preferredProvider: config.preferredProvider,
    honorDbRoutes: process.env.AI_REGISTRY_ORCHESTRATOR_ENABLED !== 'false',
    fallbackToRules: true,
  };
}

function defaultBudget(): AiBudgetSettings {
  const config = getAiPlatformConfig();
  return {
    dailyBudgetUsd: config.dailyBudgetUsd,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    emergencyBypassBudget: true,
  };
}

function defaultGovernance(): AiGovernanceSettings {
  return {
    llmEnabled: true,
    requireAiConsent: true,
  };
}

function defaultEncryption(): AiEncryptionSettings {
  return {
    apiKeyStorage: 'encrypted_at_rest',
    defaultEncryptionKeyId: 'env:v1',
    algorithm: 'aes-256-gcm',
  };
}

export class AiSettingsService {
  readonly name = 'AiSettingsService';

  async getSnapshot(scope?: AiFoundationScope): Promise<AiSettingsSnapshot> {
    const resolved = resolveFoundationScope(scope);
    const cacheKey = `settings:${resolved.scopeKey}:snapshot`;
    const cached = getCached<AiSettingsSnapshot>(cacheKey);
    if (cached) return cached;

    const hierarchy = scopeKeysForHierarchy(
      resolved.scopeKey,
      resolved.tenantId,
      resolved.branchId,
    );
    const rows = await getAiSettingsRepository().listForScopeKeys(hierarchy);

    let routing = defaultRouting();
    let budget = defaultBudget();
    let governance = defaultGovernance();
    let encryption = defaultEncryption();
    let resolvedFrom = 'environment';

    const byKey = new Map<string, (typeof rows)[number]>();
    for (const key of hierarchy) {
      for (const row of rows.filter((r) => r.scopeKey === key)) {
        if (!byKey.has(row.settingsKey)) byKey.set(row.settingsKey, row);
      }
    }

    for (const row of byKey.values()) {
      resolvedFrom = row.scopeKey;
      const json = asRecord(row.settingsJson);
      switch (row.settingsKey) {
        case 'routing.default':
          routing = mergeJson(routing, json);
          break;
        case 'budget.global':
          budget = mergeJson(budget, json);
          break;
        case 'governance.features':
          governance = mergeJson(governance, json);
          break;
        case 'security.encryption':
          encryption = mergeJson(encryption, json);
          break;
        default:
          break;
      }
    }

    if (byKey.size > 0) {
      resolvedFrom = [...byKey.values()].sort((a, b) =>
        hierarchy.indexOf(a.scopeKey) - hierarchy.indexOf(b.scopeKey),
      )[0]?.scopeKey ?? resolvedFrom;
    }

    const snapshot: AiSettingsSnapshot = {
      scopeKey: resolved.scopeKey,
      resolvedFrom,
      routing,
      budget,
      governance,
      encryption,
      loadedAt: new Date().toISOString(),
    };

    setCached(cacheKey, snapshot);
    return snapshot;
  }

  async listSettings(scopeKey: string): Promise<AiSettingsView[]> {
    const rows = await getAiSettingsRepository().listForScope(scopeKey);
    return rows.map((row) => ({
      id: row.id,
      scopeKey: row.scopeKey,
      settingsKey: row.settingsKey,
      category: row.category,
      settingsJson: asRecord(row.settingsJson),
      hasEncryptedPayload: Boolean(row.encryptedSettings),
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getSetting(scopeKey: string, settingsKey: string): Promise<AiSettingsView | null> {
    const row = await getAiSettingsRepository().findByKey(scopeKey, settingsKey);
    if (!row) return null;
    return {
      id: row.id,
      scopeKey: row.scopeKey,
      settingsKey: row.settingsKey,
      category: row.category,
      settingsJson: asRecord(row.settingsJson),
      hasEncryptedPayload: Boolean(row.encryptedSettings),
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsertSetting(params: {
    scopeKey: string;
    settingsKey: string;
    category: AiSettingsCategory;
    settingsJson: Record<string, unknown>;
    tenantId?: string | null;
    branchId?: string | null;
    actorUserId?: string;
  }): Promise<AiSettingsView> {
    const row = await getAiSettingsRepository().upsert(
      omitUndefined({
        scopeKey: params.scopeKey,
        settingsKey: params.settingsKey,
        category: params.category,
        settingsJson: toInputJson(params.settingsJson),
        tenantId: params.tenantId ?? null,
        branchId: params.branchId ?? null,
        actorUserId: params.actorUserId,
      }),
    );

    invalidateSettingsCache(params.scopeKey);
    getLogger().info(
      { scopeKey: params.scopeKey, settingsKey: params.settingsKey },
      'AI settings updated',
    );

    return {
      id: row.id,
      scopeKey: row.scopeKey,
      settingsKey: row.settingsKey,
      category: row.category,
      settingsJson: asRecord(row.settingsJson),
      hasEncryptedPayload: Boolean(row.encryptedSettings),
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  shouldHonorDbRoutes(scope?: AiFoundationScope): Promise<boolean> {
    return this.getSnapshot(scope).then((s) => s.routing.honorDbRoutes !== false);
  }
}

let service: AiSettingsService | null = null;

export function getAiSettingsService(): AiSettingsService {
  if (!service) service = new AiSettingsService();
  return service;
}

export function resetAiSettingsServiceForTests(): void {
  service = null;
}
