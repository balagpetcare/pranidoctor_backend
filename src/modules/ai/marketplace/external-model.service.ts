import { AiModelSource } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import type {
  ExtensionManifestModel,
  ExternalModelRegistrationInput,
} from './marketplace.types.js';
import { registerExternalModelSchema } from './marketplace.types.js';

export class ExternalModelRegistrationService {
  readonly name = 'ExternalModelRegistrationService';

  async register(input: ExternalModelRegistrationInput, scopeKey = PLATFORM_SCOPE_KEY) {
    const body = registerExternalModelSchema.parse(input);
    const prisma = getPrisma();

    const provider = await prisma.aiProvider.findFirst({
      where: { id: body.providerId, deletedAt: null },
    });
    if (!provider) throw new Error('Provider not found');

    const source = (body.source ?? 'EXTERNAL') as AiModelSource;
    const existing = await prisma.aiModel.findFirst({
      where: {
        scopeKey: provider.scopeKey,
        providerId: body.providerId,
        modelKey: body.modelKey,
        deletedAt: null,
      },
    });

    const data = {
      scopeKey: provider.scopeKey,
      providerId: body.providerId,
      modelKey: body.modelKey,
      displayName: body.displayName,
      externalModelId: body.externalModelId,
      source,
      modelCategory: body.modelCategory ?? 'general_chat',
      modelType: body.modelType ?? 'chat',
      contextWindow: body.contextWindow ?? null,
      inputCostPerToken: body.inputCostPerToken ?? 0,
      outputCostPerToken: body.outputCostPerToken ?? 0,
      capabilitiesJson: body.capabilitiesJson ?? ['chat'],
      metadataJson: body.metadataJson ?? { registeredVia: 'external_model_service' },
      extensionId: body.extensionId ?? null,
    };

    if (existing) {
      return prisma.aiModel.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.aiModel.create({ data });
  }

  async registerFromManifestModels(
    providerId: string,
    extensionId: string,
    models: ExtensionManifestModel[],
  ): Promise<number> {
    let count = 0;
    for (const model of models) {
      await this.register({
        providerId,
        modelKey: model.modelKey,
        displayName: model.displayName,
        externalModelId: model.externalModelId ?? model.modelKey,
        source: model.source ?? 'MARKETPLACE',
        modelCategory: model.modelCategory ?? 'general_chat',
        modelType: model.modelType ?? 'chat',
        contextWindow: model.contextWindow,
        inputCostPerToken: model.inputCostPerToken,
        outputCostPerToken: model.outputCostPerToken,
        extensionId,
        capabilitiesJson: model.capabilities,
        metadataJson: model.metadata,
      });
      count += 1;
    }
    return count;
  }

  async listExternal(scopeKey = PLATFORM_SCOPE_KEY, source?: AiModelSource) {
    const prisma = getPrisma();
    const rows = await prisma.aiModel.findMany({
      where: {
        scopeKey,
        deletedAt: null,
        source: source ?? { not: AiModelSource.BUILTIN },
      },
      include: { provider: { select: { providerKey: true, displayName: true } } },
      orderBy: [{ modelCategory: 'asc' }, { modelKey: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      providerKey: row.provider.providerKey,
      providerName: row.provider.displayName,
      modelKey: row.modelKey,
      displayName: row.displayName,
      externalModelId: row.externalModelId,
      source: row.source,
      modelCategory: row.modelCategory,
      enabled: row.enabled,
    }));
  }
}

let service: ExternalModelRegistrationService | null = null;

export function getExternalModelRegistrationService(): ExternalModelRegistrationService {
  if (!service) service = new ExternalModelRegistrationService();
  return service;
}

export function resetExternalModelRegistrationServiceForTests(): void {
  service = null;
}
