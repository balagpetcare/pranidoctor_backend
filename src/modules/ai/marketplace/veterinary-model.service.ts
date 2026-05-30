import { AiModelSource } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import {
  VETERINARY_MODEL_CATEGORIES,
  type VeterinaryModelCategory,
} from './marketplace.types.js';
import { getExternalModelRegistrationService } from './external-model.service.js';

export class VeterinaryModelService {
  readonly name = 'VeterinaryModelService';

  private readonly externalModels = getExternalModelRegistrationService();

  listCategories(): VeterinaryModelCategory[] {
    return [...VETERINARY_MODEL_CATEGORIES];
  }

  async registerVeterinaryModel(input: {
    providerId: string;
    modelKey: string;
    displayName: string;
    externalModelId: string;
    modelCategory: VeterinaryModelCategory | string;
    contextWindow?: number;
    extensionId?: string;
    metadataJson?: Record<string, unknown>;
  }) {
    return this.externalModels.register({
      providerId: input.providerId,
      modelKey: input.modelKey,
      displayName: input.displayName,
      externalModelId: input.externalModelId,
      source: 'VETERINARY',
      modelCategory: input.modelCategory,
      modelType: 'chat',
      contextWindow: input.contextWindow,
      extensionId: input.extensionId,
      capabilitiesJson: ['chat', 'veterinary'],
      metadataJson: {
        domain: 'veterinary',
        ...input.metadataJson,
      },
    });
  }

  async listVeterinaryModels(scopeKey = PLATFORM_SCOPE_KEY) {
    return this.externalModels.listExternal(scopeKey, AiModelSource.VETERINARY);
  }

  async listByCategory(category: string, scopeKey = PLATFORM_SCOPE_KEY) {
    const prisma = getPrisma();
    const rows = await prisma.aiModel.findMany({
      where: {
        scopeKey,
        modelCategory: category,
        deletedAt: null,
        enabled: true,
      },
      include: { provider: { select: { providerKey: true } } },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      modelKey: row.modelKey,
      displayName: row.displayName,
      providerKey: row.provider.providerKey,
      source: row.source,
      externalModelId: row.externalModelId,
    }));
  }
}

let service: VeterinaryModelService | null = null;

export function getVeterinaryModelService(): VeterinaryModelService {
  if (!service) service = new VeterinaryModelService();
  return service;
}

export function resetVeterinaryModelServiceForTests(): void {
  service = null;
}
