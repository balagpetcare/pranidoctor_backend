import { allProviderKeys } from '../providers/provider-config.js';
import { createAuditLog } from '../../../shared/security/audit/audit.service.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { getAiSecretService } from '../vault/ai-secret.service.js';
import { getEncryptionService } from '../vault/encryption.service.js';
import { getAiCostRateService } from '../usage/ai-cost-rate.service.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';

import type { AiAdminActor } from './ai-admin.guard.js';

const ENV_KEY_BY_PROVIDER: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  grok: 'GROK_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  self_hosted: 'SELF_HOSTED_LLM_API_KEY',
};

export type EnvKeyImportResult = {
  imported: string[];
  skipped: string[];
  errors: Array<{ providerKey: string; message: string }>;
};

export class AiFoundationAdminService {
  readonly name = 'AiFoundationAdminService';

  async getStatus(scopeKey: string = PLATFORM_SCOPE_KEY) {
    return getAiFoundationService().getStatus(scopeKey);
  }

  async syncEnvKeysToVault(actor: AiAdminActor): Promise<EnvKeyImportResult> {
    if (!getEncryptionService().isMasterKeyConfigured()) {
      throw new Error('AI_VAULT_MASTER_KEY is required before importing env keys');
    }

    const result: EnvKeyImportResult = { imported: [], skipped: [], errors: [] };
    const vault = getAiSecretService();

    for (const providerKey of allProviderKeys()) {
      const envVar = ENV_KEY_BY_PROVIDER[providerKey];
      const secret = envVar ? process.env[envVar]?.trim() : undefined;
      if (!secret) {
        result.skipped.push(providerKey);
        continue;
      }

      try {
        const existing = await vault.listKeys({ scopeKey: PLATFORM_SCOPE_KEY });
        if (existing.some((k) => k.providerKey === providerKey && (k.status === 'ACTIVE' || k.status === 'PENDING_TEST'))) {
          result.skipped.push(providerKey);
          continue;
        }

        await vault.addKey({
          scopeKey: PLATFORM_SCOPE_KEY,
          providerKey,
          name: `Env import (${envVar})`,
          secret,
          actor: { userId: actor.id, role: actor.role },
          reason: 'foundation.sync-env',
        });
        const keys = await vault.listKeys({ scopeKey: PLATFORM_SCOPE_KEY });
        const pendingKey = keys.find((k) => k.providerKey === providerKey && k.status === 'PENDING_TEST');
        if (pendingKey) {
          await vault.testKey(pendingKey.id, { userId: actor.id, role: actor.role });
        }
        result.imported.push(providerKey);
      } catch (err) {
        result.errors.push({
          providerKey,
          message: err instanceof Error ? err.message : 'Import failed',
        });
      }
    }

    getAiCostRateService().invalidateCache();

    void createAuditLog({
      action: 'SYSTEM_CONFIG_CHANGE',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'ai_foundation',
      resourceType: 'ai_api_key',
      details: {
        operation: 'foundation.sync-env',
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });

    return result;
  }
}

let service: AiFoundationAdminService | null = null;

export function getAiFoundationAdminService(): AiFoundationAdminService {
  if (!service) service = new AiFoundationAdminService();
  return service;
}

export function resetAiFoundationAdminServiceForTests(): void {
  service = null;
}
