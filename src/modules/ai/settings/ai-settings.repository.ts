import type { AiSettings, AiSettingsCategory, Prisma } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import type { ModuleService } from '../../../shared/module/module.types.js';

export interface AiSettingsRepositoryInterface extends ModuleService {
  findByKey(scopeKey: string, settingsKey: string): Promise<AiSettings | null>;
  listForScope(scopeKey: string): Promise<AiSettings[]>;
  listForScopeKeys(scopeKeys: string[]): Promise<AiSettings[]>;
  upsert(params: {
    scopeKey: string;
    settingsKey: string;
    category: AiSettingsCategory;
    settingsJson: Prisma.InputJsonValue;
    encryptedSettings?: string | null;
    encryptionKeyId?: string | null;
    tenantId?: string | null;
    branchId?: string | null;
    actorUserId?: string;
  }): Promise<AiSettings>;
}

export class AiSettingsRepository implements AiSettingsRepositoryInterface {
  readonly name = 'AiSettingsRepository';

  async findByKey(scopeKey: string, settingsKey: string): Promise<AiSettings | null> {
    return getPrisma().aiSettings.findFirst({
      where: { scopeKey, settingsKey, deletedAt: null },
    });
  }

  async listForScope(scopeKey: string): Promise<AiSettings[]> {
    return getPrisma().aiSettings.findMany({
      where: { scopeKey, deletedAt: null },
      orderBy: [{ category: 'asc' }, { settingsKey: 'asc' }],
    });
  }

  async listForScopeKeys(scopeKeys: string[]): Promise<AiSettings[]> {
    if (scopeKeys.length === 0) return [];
    return getPrisma().aiSettings.findMany({
      where: { scopeKey: { in: scopeKeys }, deletedAt: null },
      orderBy: [{ scopeKey: 'desc' }, { settingsKey: 'asc' }],
    });
  }

  async upsert(params: {
    scopeKey: string;
    settingsKey: string;
    category: AiSettingsCategory;
    settingsJson: Prisma.InputJsonValue;
    encryptedSettings?: string | null;
    encryptionKeyId?: string | null;
    tenantId?: string | null;
    branchId?: string | null;
    actorUserId?: string;
  }): Promise<AiSettings> {
    const existing = await this.findByKey(params.scopeKey, params.settingsKey);
    if (existing) {
      return getPrisma().aiSettings.update({
        where: { id: existing.id },
        data: {
          category: params.category,
          settingsJson: params.settingsJson,
          encryptedSettings: params.encryptedSettings ?? null,
          encryptionKeyId: params.encryptionKeyId ?? null,
          updatedByUserId: params.actorUserId ?? null,
          version: { increment: 1 },
        },
      });
    }

    return getPrisma().aiSettings.create({
      data: {
        scopeKey: params.scopeKey,
        settingsKey: params.settingsKey,
        category: params.category,
        settingsJson: params.settingsJson,
        encryptedSettings: params.encryptedSettings ?? null,
        encryptionKeyId: params.encryptionKeyId ?? null,
        tenantId: params.tenantId ?? null,
        branchId: params.branchId ?? null,
        createdByUserId: params.actorUserId ?? null,
        updatedByUserId: params.actorUserId ?? null,
      },
    });
  }
}

let repository: AiSettingsRepository | null = null;

export function getAiSettingsRepository(): AiSettingsRepository {
  if (!repository) repository = new AiSettingsRepository();
  return repository;
}

export function resetAiSettingsRepositoryForTests(): void {
  repository = null;
}
