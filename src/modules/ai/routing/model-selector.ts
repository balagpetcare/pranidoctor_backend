import { getPrisma } from '../../../shared/database/prisma.js';
import { AiModelNotFoundError } from './ai-router.errors.js';
import type { ModelSelectionInput, SelectedModel } from './ai-router.types.js';

export class ModelSelector {
  readonly name = 'ModelSelector';

  async select(input: ModelSelectionInput): Promise<SelectedModel> {
    const prisma = getPrisma();

    if (input.routePrimaryModelId) {
      const primary = await prisma.aiModel.findFirst({
        where: {
          id: input.routePrimaryModelId,
          providerId: input.providerId,
          deletedAt: null,
          enabled: true,
        },
      });
      if (primary) {
        return {
          modelId: primary.id,
          modelKey: primary.modelKey,
          modelType: primary.modelType,
          providerId: primary.providerId,
          enabled: primary.enabled,
        };
      }
    }

    if (input.chainModelId) {
      const chained = await prisma.aiModel.findFirst({
        where: {
          id: input.chainModelId,
          providerId: input.providerId,
          deletedAt: null,
          enabled: true,
        },
      });
      if (chained) {
        return {
          modelId: chained.id,
          modelKey: chained.modelKey,
          modelType: chained.modelType,
          providerId: chained.providerId,
          enabled: chained.enabled,
        };
      }
    }

    const modelTypeFilter = input.modelTypeHint
      ? { modelType: input.modelTypeHint }
      : {};

    const defaultModel = await prisma.aiModel.findFirst({
      where: {
        scopeKey: input.scopeKey,
        providerId: input.providerId,
        enabled: true,
        deletedAt: null,
        isDefault: true,
        ...modelTypeFilter,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (defaultModel) {
      return {
        modelId: defaultModel.id,
        modelKey: defaultModel.modelKey,
        modelType: defaultModel.modelType,
        providerId: defaultModel.providerId,
        enabled: defaultModel.enabled,
      };
    }

    const fallbackModel = await prisma.aiModel.findFirst({
      where: {
        scopeKey: input.scopeKey,
        providerId: input.providerId,
        enabled: true,
        deletedAt: null,
        ...modelTypeFilter,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    if (fallbackModel) {
      return {
        modelId: fallbackModel.id,
        modelKey: fallbackModel.modelKey,
        modelType: fallbackModel.modelType,
        providerId: fallbackModel.providerId,
        enabled: fallbackModel.enabled,
      };
    }

    throw new AiModelNotFoundError(input.providerKey, input.scopeKey);
  }
}

let modelSelector: ModelSelector | null = null;

export function getModelSelector(): ModelSelector {
  if (!modelSelector) modelSelector = new ModelSelector();
  return modelSelector;
}

export function resetModelSelectorForTests(): void {
  modelSelector = null;
}
