import { AiSettingsCategory } from '../../../generated/prisma/index.js';
import { createAuditLog } from '../../../shared/security/audit/audit.service.js';
import { invalidateSettingsCache } from '../settings/ai-settings.cache.js';
import { getAiSettingsService } from '../settings/ai-settings.service.js';
import type { AiSettingsView } from '../settings/ai-settings.types.js';
import { getAiCostRateService } from '../usage/ai-cost-rate.service.js';

import { validateSettingsPayload } from './ai-admin.schemas.js';
import type { AiAdminActor } from './ai-admin.guard.js';

const SETTINGS_KEY_CATEGORY: Record<string, AiSettingsCategory> = {
  'routing.default': AiSettingsCategory.ROUTING,
  'budget.global': AiSettingsCategory.BUDGET,
  'security.encryption': AiSettingsCategory.ENCRYPTION,
  'governance.features': AiSettingsCategory.GOVERNANCE,
};

export class AiSettingsAdminService {
  readonly name = 'AiSettingsAdminService';

  async list(scopeKey?: string): Promise<AiSettingsView[]> {
    const key = scopeKey?.trim() || 'platform';
    return getAiSettingsService().listSettings(key);
  }

  async get(scopeKey: string, settingsKey: string): Promise<AiSettingsView | null> {
    return getAiSettingsService().getSetting(scopeKey, settingsKey);
  }

  async upsert(
    scopeKey: string,
    settingsKey: string,
    settingsJson: Record<string, unknown>,
    actor: AiAdminActor,
  ): Promise<AiSettingsView> {
    const validatedJson = validateSettingsPayload(settingsKey, settingsJson);
    const category = SETTINGS_KEY_CATEGORY[settingsKey] ?? AiSettingsCategory.FEATURE_FLAGS;
    const previous = await getAiSettingsService().getSetting(scopeKey, settingsKey);

    const saved = await getAiSettingsService().upsertSetting({
      scopeKey,
      settingsKey,
      category,
      settingsJson: validatedJson,
      actorUserId: actor.id,
    });

    invalidateSettingsCache(scopeKey);
    getAiCostRateService().invalidateCache();

    void createAuditLog({
      action: 'AI_SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'ai_settings',
      targetId: saved.id,
      resourceType: 'ai_settings',
      resourceId: settingsKey,
      details: {
        scopeKey,
        settingsKey,
        previousVersion: previous?.version ?? null,
        newVersion: saved.version,
      },
    });

    return saved;
  }
}

let service: AiSettingsAdminService | null = null;

export function getAiSettingsAdminService(): AiSettingsAdminService {
  if (!service) service = new AiSettingsAdminService();
  return service;
}

export function resetAiSettingsAdminServiceForTests(): void {
  service = null;
}
